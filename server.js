const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const ext =
        path.extname(file.originalname || "").toLowerCase() || ".jpg";

      cb(null, `trendpix-${crypto.randomUUID()}${ext}`);
    }
  }),

  limits: {
    fileSize: 8 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG or WEBP images are allowed"));
    }
  }
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 0
});

app.get("/", (req, res) => {
  res.send("TrendPix AI Backend is running!");
});

app.post("/generate", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No image uploaded"
      });
    }

    const style = req.body.style || "Retro Film";

    const prompt =
      `Edit this uploaded photo in the style: ${style}. ` +
      `Keep the person's identity, face, facial features, skin tone, ` +
      `and natural appearance consistent. ` +
      `Create a realistic high-quality AI photo.`;

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: fs.createReadStream(req.file.path),
      prompt: prompt,
      input_fidelity: "high",
      quality: "low",
      size: "1024x1024",
      output_format: "jpeg",
      output_compression: 60,
      n: 1
    });

    const imageData = result.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error("No image returned from AI");
    }

    res.json({
      success: true,
      image: imageData
    });

  } catch (error) {
    console.error("AI generation error:", error);

    res.status(error.status || 500).json({
      error: error.message || "AI generation failed"
    });

  } finally {
    if (req.file?.path) {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
});

app.use((error, req, res, next) => {
  console.error("Upload error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "Image is too large. Maximum size is 8 MB."
      });
    }
  }

  res.status(400).json({
    error: error.message || "Upload failed"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`TrendPix AI backend running on port ${PORT}`);
});
