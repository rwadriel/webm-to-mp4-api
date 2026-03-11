const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();

const TMP_DIR = "/tmp/webm-api";
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const upload = multer({
  dest: TMP_DIR,
  limits: {
    fileSize: 1024 * 1024 * 500, // 500 MB
  },
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/convert", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Envie o arquivo no campo "video".' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(TMP_DIR, `${req.file.filename}.mp4`);

  const ffmpeg = spawn("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-movflags", "+faststart",
    outputPath
  ]);

  let stderr = "";

  ffmpeg.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  ffmpeg.on("close", (code) => {
    if (code !== 0) {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
      return res.status(500).json({
        error: "Falha na conversão com FFmpeg",
        details: stderr,
      });
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", 'attachment; filename="converted.mp4"');

    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);

    stream.on("close", () => {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
    });
  });

  ffmpeg.on("error", (err) => {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
    return res.status(500).json({
      error: "Erro ao iniciar FFmpeg",
      details: err.message,
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API rodando na porta ${PORT}`);
});