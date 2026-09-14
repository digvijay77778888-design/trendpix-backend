const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const { toFile } = require("openai");

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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
      `Keep the person's identity, face, facial features, skin tone and natural appearance consistent. ` +
      `Create a realistic high-quality photo.`;

    const inputFile = await toFile(
      req.file.buffer,
      req.file.originalname || "input.jpg",
      {
        type: req.file.mimetype || "image/jpeg"
      }
    );

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: inputFile,
      prompt: prompt,
      input_fidelity: "high",
      quality: "low",
      size: "1024x1024",
      output_format: "jpeg",
      output_compression: 60
    });

    if (!result.data || !result.data[0] || !result.data[0].b64_json) {
      return res.status(500).json({
        error: "No image returned from AI"
      });
    }

    res.json({
      success: true,
      image: result.data[0].b64_json
    });

  } catch (error) {
    console.error("AI generation error:", error);

    res.status(500).json({
      error: error.message || "AI generation failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`TrendPix AI backend running on port ${PORT}`);
});
