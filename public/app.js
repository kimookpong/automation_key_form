(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function renderJobsRow(j) {
    return `<tr>
      <td>${j.id}</td>
      <td><span class="badge ${j.status}">${j.status}</span></td>
      <td>${j.total}</td>
      <td>${j.success}</td>
      <td>${j.failed}</td>
      <td>${j.startedAt || "-"}</td>
      <td>${j.endedAt || "-"}</td>
      <td><a class="btn" href="/jobs/${j.id}">ดู</a></td>
    </tr>`;
  }

  function updateJobsTable(tbody, jobs) {
    if (!tbody) return;
    tbody.innerHTML = jobs.map(renderJobsRow).join("");
  }

  window.setupJobsList = function (tbody) {
    // Initial fetch
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => updateJobsTable(tbody, data));
    // Listen SSE
    const es = new EventSource("/events");
    es.addEventListener("update", (e) => {
      fetch("/api/jobs")
        .then((r) => r.json())
        .then((data) => updateJobsTable(tbody, data));
    });
  };

  window.setupJobDetail = function (jobId) {
    const statusEl = byId("status");
    const totalEl = byId("total");
    const processedEl = byId("processed");
    const successEl = byId("success");
    const failedEl = byId("failed");
    const startedAtEl = byId("startedAt");
    const endedAtEl = byId("endedAt");
    const progressEl = byId("progress");
    const resultsEl = byId("results");
    const logEl = byId("log");
    const liveSnapEl = byId("live-snap");

    function renderResultRow(r) {
      const status = r.ok ? "สำเร็จ" : "ผิดพลาด";
      const note = r.error || r.note || "";
      const dataStr = r.data ? JSON.stringify(r.data) : "";
      return `<tr>
        <td>${r.index}</td>
        <td>${status}</td>
        <td><code>${dataStr}</code></td>
        <td>${note}</td>
      </tr>`;
    }

    function fillJob(job) {
      statusEl.textContent = job.status;
      statusEl.className = `badge ${job.status}`;
      totalEl.textContent = job.total;
      processedEl.textContent = job.processed;
      successEl.textContent = job.success;
      failedEl.textContent = job.failed;
      startedAtEl.textContent = job.startedAt || "-";
      endedAtEl.textContent = job.endedAt || "-";
      progressEl.max = job.total;
      progressEl.value = job.processed;
      resultsEl.innerHTML = (job.results || []).map(renderResultRow).join("");
      logEl.textContent = (job.log || []).join("\n");
    }

    function refreshJob() {
      fetch(`/api/jobs/${jobId}`)
        .then((r) => {
          if (r.status === 404) return null;
          return r.json();
        })
        .then((job) => {
          if (job) fillJob(job);
        });
    }

    refreshJob();

    const es = new EventSource("/events");
    es.addEventListener("update", (e) => {
      const payload = JSON.parse(e.data);
      if (
        (payload && payload.jobId === jobId) ||
        (payload.job && payload.job.id === jobId)
      ) {
        refreshJob();
      }
      // Update live screenshot when event carries one
      if (
        payload &&
        payload.payload &&
        payload.payload.type === "screenshot" &&
        payload.payload.path
      ) {
        if (liveSnapEl) {
          const url =
            payload.payload.path + "?t=" + (payload.payload.ts || Date.now());
          liveSnapEl.src = url;
          liveSnapEl.style.display = "block";
        }
      }
    });
  };
})();
