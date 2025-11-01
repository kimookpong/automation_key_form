require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { parseExcel } = require("./utils/excel");
const { jobManager } = require("./jobs/jobManager");

const app = express();
const PORT = process.env.PORT || 3000;

// Views & static
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Uploads
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// Routes
app.get("/", (req, res) => {
  const jobs = jobManager.listJobs();
  res.render("index", { jobs });
});

app.get("/jobs/:id", (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) return res.status(404).send("Job not found");
  res.render("job", { job });
});

app.get("/api/jobs", (req, res) => {
  res.json(jobManager.listJobs());
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// SSE events for live progress
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders && res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onAny = (payload) => send("update", payload);
  jobManager.events.on("update", onAny);

  req.on("close", () => {
    jobManager.events.off("update", onAny);
    res.end();
  });
});

// Start Step 1 only (login check, no Excel needed)
app.post("/start-login", async (req, res) => {
  try {
    const username = req.body.username?.trim();
    const password = req.body.password?.trim();
    const showBrowser = ["on", "true", "1", true].includes(
      req.body.showBrowser
    );
    if (!username || !password) {
      return res.status(400).send("Missing username or password");
    }

    const jobId = jobManager.createJob({
      username,
      password,
      filePath: null,
      rows: [], // Step 1 only
      showBrowser,
    });
    jobManager.startJob(jobId).catch((err) => {
      console.error("Job failed to start", err);
    });
    res.redirect(`/jobs/${jobId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Upload and start job
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const username = req.body.username?.trim();
    const password = req.body.password?.trim();
    if (!username || !password) {
      return res.status(400).send("Missing username or password");
    }
    if (!req.file) {
      return res.status(400).send("Missing Excel file");
    }
    const showBrowser = ["on", "true", "1", true].includes(
      req.body.showBrowser
    );

    const rows = await parseExcel(req.file.path);
    if (!rows.length) {
      return res.status(400).send("Excel has no data rows");
    }

    const jobId = jobManager.createJob({
      username,
      password,
      filePath: req.file.path,
      rows,
      showBrowser,
    });
    // Start async; redirect to job page
    jobManager.startJob(jobId).catch((err) => {
      console.error("Job failed to start", err);
    });

    res.redirect(`/jobs/${jobId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
