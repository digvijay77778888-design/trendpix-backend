const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const { toFile } = require("openai");
const sharp = require("sharp");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();

/* =========================
   REQUEST LOG
========================= */

app.use((req, res, next) => {
  console.log("INCOMING REQUEST:", req.method, req.url);
  next();
});

/* =========================
   UPLOAD
========================= */

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),

    filename: (req, file, cb) => {
      const ext =
        path.extname(file.originalname || "").toLowerCase() || ".jpg";

      cb(
        null,
        `trendpix-${crypto.randomUUID()}${ext}`
      );
    }
  }),

  limits: {
    fileSize: 5 * 1024 * 1024
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
      cb(
        new Error(
          "Only JPG, PNG or WEBP images are allowed"
        )
      );
    }
  }
});

/* =========================
   OPENAI
========================= */

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 0
});

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  console.log("HOME REQUEST RECEIVED");

  res.send(
    "TrendPix AI Backend is running!"
  );
});

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  console.log("HEALTH CHECK RECEIVED");

  res.json({
    success: true,
    message: "TrendPix backend is healthy"
  });
});

/* =========================
   GENERATE
========================= */

app.post(
  "/generate",
  upload.single("image"),
  async (req, res) => {

    let inputPath = null;
    let normalizedPath = null;

    console.log(
      "GENERATE REQUEST RECEIVED"
    );

    try {

      /* =========================
         CHECK IMAGE
      ========================= */

      if (!req.file) {

        console.log(
          "NO IMAGE RECEIVED"
        );

        return res.status(400).json({
          error: "No image uploaded"
        });
      }

      inputPath = req.file.path;

      const style =
        req.body.style || "Retro Film";

      console.log(
        "IMAGE RECEIVED:",
        req.file.originalname
      );

      console.log(
        "STYLE:",
        style
      );

      /* =========================
         NORMALIZE IMAGE TO PNG
      ========================= */

      normalizedPath = path.join(
        os.tmpdir(),
        `trendpix-normalized-${crypto.randomUUID()}.png`
      );

      console.log(
        "NORMALIZING IMAGE TO PNG"
      );

      await sharp(inputPath)
        .png()
        .toFile(normalizedPath);

      console.log(
        "IMAGE NORMALIZED TO PNG"
      );

      /* =========================
         CREATE PROPER OPENAI FILE
      ========================= */

      console.log(
        "CREATING OPENAI IMAGE FILE"
      );

      const imageFile = await toFile(
        fs.createReadStream(normalizedPath),
        "image.png",
        {
          type: "image/png"
        }
      );

      console.log(
        "OPENAI IMAGE FILE READY:",
        imageFile.name,
        imageFile.type
      );

      /* =========================
         AI PROMPT
      ========================= */

      const prompt =
        `Edit this uploaded photo in the style: ${style}. ` +
        `Keep the person's identity, face, facial features, ` +
        `skin tone and natural appearance consistent. ` +
        `Create a realistic high-quality photo.`;

      console.log(
        "Starting AI generation:",
        style
      );

      /* =========================
         OPENAI IMAGE EDIT
      ========================= */

      const stream =
        await client.images.edit({

          model: "gpt-image-1",

          image: imageFile,

          prompt: prompt,

          input_fidelity: "high",

          quality: "low",

          size: "1024x1024",

          output_format: "jpeg",

          output_compression: 60,

          stream: true,

          partial_images: 0
        });

      let finalImage = null;

      /* =========================
         READ AI STREAM
      ========================= */

      for await (const event of stream) {

        console.log(
          "AI EVENT:",
          event.type
        );

        if (
          event.type ===
          "image_edit.completed"
        ) {

          finalImage =
            event.b64_json;

          console.log(
            "AI GENERATION COMPLETED"
          );
        }
      }

      /* =========================
         CHECK RESULT
      ========================= */

      if (!finalImage) {

        throw new Error(
          "AI did not return an image"
        );
      }

      console.log(
        "SENDING RESULT TO APP"
      );

      res.json({
        success: true,
        image: finalImage
      });

    } catch (error) {

      console.error(
        "AI GENERATION ERROR:",
        error
      );

      if (!res.headersSent) {

        res.status(
          error.status || 500
        ).json({

          error:
            error.message ||
            "AI generation failed"

        });
      }

    } finally {

      /* =========================
         CLEAN TEMP FILES
      ========================= */

      if (inputPath) {

        fs.promises
          .unlink(inputPath)
          .catch(() => {});

      }

      if (normalizedPath) {

        fs.promises
          .unlink(normalizedPath)
          .catch(() => {});

      }
    }
  }
);

/* =========================
   UPLOAD ERROR
========================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "UPLOAD ERROR:",
      error
    );

    if (
      error instanceof
      multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({
          error:
            "Image is too large. Maximum size is 5 MB."
        });
      }
    }

    res.status(400).json({

      error:
        error.message ||
        "Upload failed"

    });
  }
);

/* =========================
   SERVER
========================= */

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `TrendPix AI backend running on port ${PORT}`
  );

});
