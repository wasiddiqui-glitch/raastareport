const prisma = require("../prismaClient");

const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await prisma.comment.findMany({
      where: { hazardId: Number(id) },
      orderBy: { createdAt: "asc" },
    });
    res.json(comments);
  } catch (error) {
    console.error("GET comments error:", error);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
};

const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, author } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const comment = await prisma.comment.create({
      data: {
        hazardId: Number(id),
        text: text.trim(),
        author: author && author.trim() ? author.trim() : "Anonymous",
      },
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error("POST comment error:", error);
    res.status(500).json({ message: "Failed to add comment" });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    await prisma.comment.delete({ where: { id: Number(commentId) } });
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE comment error:", error);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

module.exports = { getComments, addComment, deleteComment };
