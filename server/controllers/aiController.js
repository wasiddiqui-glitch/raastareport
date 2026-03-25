const prisma = require("../prismaClient");
const openai = require("../lib/openai");

const HAZARD_TYPES = [
  "Pothole",
  "Open Manhole",
  "Broken Traffic Light",
  "Flooded Road",
  "Construction Debris",
  "Missing Road Sign",
  "Damaged Divider",
  "Street Light Out",
  "Other",
];

// POST /api/ai/analyze-image
// Accepts a photo (memory buffer) and returns { type, description, severity }
const analyzeImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image provided" });

    const base64 = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this road hazard photo from a Pakistani city.

Identify:
1. The hazard type — must be exactly one of: ${HAZARD_TYPES.join(", ")}
2. A 2-3 sentence description suitable for a public hazard report. Describe what you see concretely.
3. Severity — exactly one of: Low, Medium, High, Critical
   (Low = minor inconvenience, Medium = notable risk, High = significant danger, Critical = immediate life threat)

Respond ONLY as valid JSON with no markdown fences:
{"type": "...", "description": "...", "severity": "..."}`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI response format");

    const result = JSON.parse(jsonMatch[0]);

    // Validate type is one we recognise
    if (!HAZARD_TYPES.includes(result.type)) result.type = "Other";

    res.json(result);
  } catch (error) {
    console.error("AI analyze-image error:", error);
    res.status(500).json({ message: "Failed to analyze image" });
  }
};

// POST /api/ai/report/:id
// Generates a formal authority complaint letter for a hazard
const generateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const hazard = await prisma.hazard.findUnique({ where: { id: Number(id) } });
    if (!hazard) return res.status(404).json({ message: "Hazard not found" });

    const location = [hazard.area, hazard.city].filter(Boolean).join(", ");
    const reportedDate = new Date(hazard.createdAt).toLocaleDateString("en-PK", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Write a formal complaint letter in English addressed to "The Municipal Commissioner" about a road hazard in Pakistan.

Hazard details:
- Title: ${hazard.title}
- Type: ${hazard.type}
- Location: ${location}
- Description: ${hazard.description}
- Severity: ${hazard.severity}
- Date first reported: ${reportedDate}
- Community confirmations (upvotes): ${hazard.upvotes}

Requirements:
- Keep it under 280 words
- Be formal and direct
- Mention the specific location and hazard type clearly
- State the danger to public safety based on severity
- Note that ${hazard.upvotes} community members have independently confirmed this hazard
- Demand a specific, urgent response
- Sign off as: "A Concerned Citizen\nvia RaastaReport — Citizen Hazard Network"

Write only the letter, nothing else.`,
        },
      ],
      max_tokens: 500,
    });

    res.json({ report: response.choices[0].message.content.trim() });
  } catch (error) {
    console.error("Generate report error:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

module.exports = { analyzeImage, generateReport };
