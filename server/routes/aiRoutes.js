const express = require("express");
const router = express.Router();
const multer = require("multer");

const { analyzeImage, generateReport } = require("../controllers/aiController");

// Memory storage — no disk write needed for AI analysis
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Images only"));
  },
});

router.post("/analyze-image", upload.single("photo"), analyzeImage);
router.post("/report/:id", generateReport);

module.exports = router;
