const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

const {
  getHazards,
  createHazard,
  updateHazardStatus,
  upvoteHazard,
  unvoteHazard,
  deleteHazard,
  toggleRecurring,
  checkDuplicate,
} = require("../controllers/hazardController");

const { getComments, addComment, deleteComment } = require("../controllers/commentController");
const { addClient, removeClient } = require("../sse");
const { requireAuth } = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");

const createHazardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many reports submitted. Please wait 15 minutes." },
});

const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many comments. Please wait 15 minutes." },
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// Must be before /:id routes to avoid these paths being treated as an id
router.get("/check-duplicate", checkDuplicate);

router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  addClient(res);
  req.on("close", () => removeClient(res));
});

router.get("/", getHazards);
router.post("/", requireAuth, createHazardLimiter, upload.single("photo"), createHazard);
router.patch("/:id/status", updateHazardStatus);
router.patch("/:id/upvote", upvoteHazard);
router.patch("/:id/unvote", unvoteHazard);
router.patch("/:id/recurring", toggleRecurring);
router.delete("/:id", requireAuth, deleteHazard);

// Comments nested under hazards
router.get("/:id/comments", getComments);
router.post("/:id/comments", commentLimiter, addComment);
router.delete("/:id/comments/:commentId", deleteComment);

module.exports = router;
