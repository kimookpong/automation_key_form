const { EventEmitter } = require("events");
const { runAutomation } = require("../automation/smartbmn");
const path = require("path");

class JobManager {
  constructor() {
    this.events = new EventEmitter();
    this.jobs = new Map();
    this.counter = 1;
  }

  createJob({ username, password, rows, filePath, showBrowser }) {
    const id = `${Date.now()}-${this.counter++}`;
    const job = {
      id,
      status: "queued", // queued | running | completed | failed | cancelled
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      username, // kept only in memory
      password,
      filePath,
      total: rows.length,
      processed: 0,
      success: 0,
      failed: 0,
      rows,
      results: [],
      log: [],
      options: { showBrowser: !!showBrowser },
    };
    this.jobs.set(id, job);
    this.events.emit("update", {
      type: "job-created",
      job: this.publicJob(job),
    });
    return id;
  }

  listJobs() {
    return Array.from(this.jobs.values()).map((j) => this.publicJob(j));
  }

  getJob(id) {
    const job = this.jobs.get(id);
    return job ? this.publicJob(job) : null;
  }

  async startJob(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error("Job not found");
    if (job.status !== "queued") return;

    job.status = "running";
    job.startedAt = new Date().toISOString();
    this.events.emit("update", {
      type: "job-started",
      job: this.publicJob(job),
    });

    const onProgress = (p) => {
      if (p.type === "row") {
        job.processed++;
        if (p.ok) job.success++;
        else job.failed++;
        job.results.push(p);
      }
      if (p.msg) job.log.push(`[${new Date().toISOString()}] ${p.msg}`);
      this.events.emit("update", {
        type: "progress",
        jobId: job.id,
        payload: p,
        job: this.publicJob(job),
      });
    };

    try {
      await runAutomation({
        jobId: job.id,
        credentials: { username: job.username, password: job.password },
        rows: job.rows,
        onProgress,
        options: {
          headless: !(job.options && job.options.showBrowser),
          snapshotDir: path.join(__dirname, "..", "..", "public", "snapshots"),
        },
      });
      job.status = "completed";
      job.endedAt = new Date().toISOString();
      this.events.emit("update", {
        type: "job-completed",
        job: this.publicJob(job),
      });
    } catch (err) {
      job.status = "failed";
      job.endedAt = new Date().toISOString();
      job.log.push(`[${new Date().toISOString()}] ERROR: ${err.message}`);
      this.events.emit("update", {
        type: "job-failed",
        job: this.publicJob(job),
        error: err.message,
      });
    } finally {
      // Clear sensitive fields
      job.username = undefined;
      job.password = undefined;
    }
  }

  publicJob(job) {
    // Exclude credentials
    const { username, password, rows, ...rest } = job;
    return { ...rest };
  }
}

const jobManager = new JobManager();
module.exports = { jobManager };
