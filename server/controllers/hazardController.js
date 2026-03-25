const prisma = require("../prismaClient");
const openai = require("../lib/openai");
const { haversineKm } = require("../utils/haversine");
const { broadcast } = require("../sse");

const VALID_SEVERITIES = ["Low", "Medium", "High", "Critical"];

async function assessSeverity(type, description) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `A road hazard has been reported in a Pakistani city.
Type: ${type}
Description: ${description}

Rate its severity as exactly one word:
- Low: minor inconvenience, passable
- Medium: notable risk, slows traffic or causes discomfort
- High: significant danger, likely to cause injury
- Critical: immediate life threat, requires urgent closure

Respond with only the single word.`,
        },
      ],
      max_tokens: 5,
    });
    const raw = res.choices[0].message.content.trim();
    return VALID_SEVERITIES.includes(raw) ? raw : "Unknown";
  } catch {
    return "Unknown";
  }
}


const getHazards = async (req, res) => {
  try {
    const hazards = await prisma.hazard.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { comments: true } } },
    });
    res.json(hazards);
  } catch (error) {
    console.error("GET hazards error:", error);
    res.status(500).json({ message: "Failed to fetch hazards" });
  }
};

const createHazard = async (req, res) => {
  try {
    const { title, type, description, city, area, latitude, longitude, reporterName } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !type || !description || !city) {
      return res.status(400).json({
        message: "Title, type, description and city are required",
      });
    }

    const severity = await assessSeverity(type, description);

    const newHazard = await prisma.hazard.create({
      data: {
        title,
        type,
        description,
        city,
        area,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        imageUrl,
        severity,
        reporterName: reporterName && reporterName.trim() ? reporterName.trim() : null,
        userId: req.user.id,
      },
      include: { _count: { select: { comments: true } } },
    });

    broadcast("hazard-created", newHazard);
    res.status(201).json(newHazard);
  } catch (error) {
    console.error("POST hazard error:", error);
    res.status(500).json({ message: "Failed to create hazard" });
  }
};

const updateHazardStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const updatedHazard = await prisma.hazard.update({
      where: { id: Number(id) },
      data: { status },
      include: { _count: { select: { comments: true } } },
    });

    broadcast("hazard-updated", updatedHazard);
    res.json(updatedHazard);
  } catch (error) {
    console.error("PATCH status error:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
};

const upvoteHazard = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.hazard.update({
      where: { id: Number(id) },
      data: { upvotes: { increment: 1 } },
      include: { _count: { select: { comments: true } } },
    });
    res.json(updated);
  } catch (error) {
    console.error("PATCH upvote error:", error);
    res.status(500).json({ message: "Failed to upvote hazard" });
  }
};

const unvoteHazard = async (req, res) => {
  try {
    const { id } = req.params;
    const hazard = await prisma.hazard.findUnique({ where: { id: Number(id) } });
    if (!hazard) return res.status(404).json({ message: "Hazard not found" });
    const updated = await prisma.hazard.update({
      where: { id: Number(id) },
      data: { upvotes: { decrement: hazard.upvotes > 0 ? 1 : 0 } },
      include: { _count: { select: { comments: true } } },
    });
    res.json(updated);
  } catch (error) {
    console.error("PATCH unvote error:", error);
    res.status(500).json({ message: "Failed to unvote hazard" });
  }
};

const deleteHazard = async (req, res) => {
  try {
    const { id } = req.params;
    const hazard = await prisma.hazard.findUnique({ where: { id: Number(id) } });
    if (!hazard) return res.status(404).json({ message: "Hazard not found" });
    if (hazard.userId !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to delete this hazard" });
    }
    await prisma.hazard.delete({ where: { id: Number(id) } });
    broadcast("hazard-deleted", { id: Number(id) });
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE hazard error:", error);
    res.status(500).json({ message: "Failed to delete hazard" });
  }
};

const toggleRecurring = async (req, res) => {
  try {
    const { id } = req.params;
    const hazard = await prisma.hazard.findUnique({ where: { id: Number(id) } });
    if (!hazard) return res.status(404).json({ message: "Hazard not found" });

    const updated = await prisma.hazard.update({
      where: { id: Number(id) },
      data: { isRecurring: !hazard.isRecurring },
      include: { _count: { select: { comments: true } } },
    });
    res.json(updated);
  } catch (error) {
    console.error("PATCH recurring error:", error);
    res.status(500).json({ message: "Failed to toggle recurring" });
  }
};

const checkDuplicate = async (req, res) => {
  try {
    const { type, city, area, lat, lng } = req.query;
    if (!type || !city) return res.json({ isDuplicate: false });

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const candidates = await prisma.hazard.findMany({
      where: {
        type,
        city,
        status: { not: "Fixed" },
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (candidates.length === 0) return res.json({ isDuplicate: false });

    if (lat && lng) {
      const latN = parseFloat(lat);
      const lngN = parseFloat(lng);
      for (const c of candidates) {
        if (c.latitude && c.longitude) {
          if (haversineKm(latN, lngN, c.latitude, c.longitude) < 0.2) {
            return res.json({ isDuplicate: true, similar: c });
          }
        }
      }
    }

    if (area) {
      const match = candidates.find((c) => c.area === area);
      if (match) return res.json({ isDuplicate: true, similar: match });
    }

    res.json({ isDuplicate: false });
  } catch (error) {
    console.error("Check duplicate error:", error);
    res.status(500).json({ message: "Failed to check duplicates" });
  }
};

module.exports = {
  getHazards,
  createHazard,
  updateHazardStatus,
  upvoteHazard,
  unvoteHazard,
  deleteHazard,
  toggleRecurring,
  checkDuplicate,
};
