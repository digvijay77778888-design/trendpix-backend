
const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

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
      `Keep the person's identity, face, facial features and natural appearance consistent. ` +
      `Create a high-quality realistic AI photo.`;

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: req.file.buffer,
      prompt: prompt
    });

    res.json({
      success: true,
      image: result.data[0].b64_json
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "AI generation failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`TrendPix AI backend running on port ${PORT}`);
});
