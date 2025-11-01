# Automation Key Form (smartbmn.cdd.go.th)

A Node.js service that logs in to https://smartbmn.cdd.go.th/, then fills a form repeatedly from an uploaded Excel file. Includes a simple monitoring UI to track progress, per-row results, and errors.

## Features

- Upload Excel (.xlsx) with rows to submit
- Provide username/password via UI (not stored on disk)
- Automates login and form fill using Playwright
- Live progress via SSE and job dashboard
- Minimal configuration file for selectors to adapt to site changes

> Note: CSS/XPath selectors for the target site are placeholders. You must inspect the site and update `src/automation/smartbmn.js` under `SELECTORS`.

## Quick start

1. Install dependencies (this also installs Playwright browsers):

```powershell
npm install
```

2. Run the dev server (auto-restarts on change):

```powershell
npm run dev
```

3. Open the UI:

- http://localhost:3000

4. Upload your Excel and enter credentials. Start the job and monitor progress.

## Excel format

- First row is headers. Each following row is one submission.
- Map the header names to the corresponding form fields inside `mapRowToForm` in `src/automation/smartbmn.js`.

## Environment

- PORT: web server port (default 3000)

Create a `.env` file if needed:

```
PORT=3000
```

## Updating selectors

- Open DevTools on the site, find inputs and buttons, and update the `SELECTORS` object in `src/automation/smartbmn.js`.
- Test with a few rows before running large batches.

## Safety

- Credentials are accepted via form and kept in-memory for the current job only.
- Consider using a dedicated account with least privileges.

## Known limitations

- Without valid selectors, the automation will run in dry-run mode and only simulate submissions.
- This project doesn’t include a database; job state persists in-memory per process.

## License

MIT
