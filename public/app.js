(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  // Format ISO date to Thai format: 1/11/2568 23:19:45
  function formatThaiDateTime(isoString) {
    if (!isoString || isoString === "-") return "-";
    try {
      const date = new Date(isoString);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear() + 543; // Buddhist Era
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return isoString;
    }
  }

  function renderJobsRow(j) {
    return `<tr>
      <td>${j.id}</td>
      <td><span class="badge ${j.status}">${j.status}</span></td>
      <td>${j.total}</td>
      <td>${j.success}</td>
      <td>${j.failed}</td>
      <td>${formatThaiDateTime(j.startedAt)}</td>
      <td>${formatThaiDateTime(j.endedAt)}</td>
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
      return [r.index, status, `<code>${dataStr}</code>`, note];
    }

    function fillJob(job) {
      let displayStatus = job.status;
      let statusClass = job.status;

      // Check if log contains LOGIN FAILED
      const logText = (job.log || []).join("\n");
      if (logText.includes("❌ LOGIN FAILED")) {
        displayStatus = "failed";
        statusClass = "failed";
      }

      statusEl.textContent = displayStatus;
      statusEl.className = `badge ${statusClass}`;
      totalEl.textContent = job.total;
      processedEl.textContent = job.processed;
      successEl.textContent = job.success;
      failedEl.textContent = job.failed;
      startedAtEl.textContent = formatThaiDateTime(job.startedAt);
      endedAtEl.textContent = formatThaiDateTime(job.endedAt);
      progressEl.max = job.total;
      progressEl.value = job.processed;

      // Update DataTable if it exists, otherwise fallback to innerHTML
      if (window.resultsTable) {
        window.resultsTable.clear();
        const results = job.results || [];
        if (results.length > 0) {
          results.forEach((r) => {
            window.resultsTable.row.add(renderResultRow(r));
          });
        }
        window.resultsTable.draw();
      } else {
        // Fallback for non-DataTable
        resultsEl.innerHTML = (job.results || [])
          .map((r) => {
            const status = r.ok ? "สำเร็จ" : "ผิดพลาด";
            const note = r.error || r.note || "";
            const dataStr = r.data ? JSON.stringify(r.data) : "";
            return `<tr>
            <td>${r.index}</td>
            <td>${status}</td>
            <td><code>${dataStr}</code></td>
            <td>${note}</td>
          </tr>`;
          })
          .join("");
      }

      logEl.textContent = logText;
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
