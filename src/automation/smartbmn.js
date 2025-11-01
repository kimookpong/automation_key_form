const { chromium } = require("playwright");

const SELECTORS = {
  login: {
    username: "#inputUsername",
    password: "#inputPassword",
    submit: "#login-button",
  },
  baseUrl: "https://smartbmn.cdd.go.th/",
};

async function runAutomation({
  jobId,
  credentials,
  rows,
  onProgress,
  options = {},
}) {
  const notify = (p) => {
    try {
      onProgress && onProgress(p);
    } catch {}
  };
  const headless = options.headless !== false;
  const snapshotDir = options.snapshotDir;
  const latestSnapName = jobId ? `${jobId}-latest.png` : `latest.png`;
  const latestSnapRel = snapshotDir
    ? `/public/snapshots/${latestSnapName}`
    : undefined;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  async function snap(note) {
    if (!snapshotDir) return;
    try {
      const fs = require("fs");
      const path = require("path");
      if (!fs.existsSync(snapshotDir))
        fs.mkdirSync(snapshotDir, { recursive: true });
      const outPath = path.join(snapshotDir, latestSnapName);
      await page.screenshot({ path: outPath, fullPage: true });
      notify({ type: "screenshot", path: latestSnapRel, note, ts: Date.now() });
    } catch (e) {}
  }
  try {
    const baseUrl = SELECTORS.baseUrl;
    notify({ msg: `🌐 Opening ${baseUrl}...` });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await snap("opened");
    await page.waitForTimeout(1500);
    let currentUrl = page.url();
    notify({ msg: `📍 Current URL: ${currentUrl}` });
    const isHome = /\/Home(\b|\/|\?|$)/i;
    const isLogin = /\/Login(\b|\/|\?|$)/i;
    if (isHome.test(currentUrl)) {
      notify({ msg: "✅ Already logged in" });
      return;
    }
    if (!isLogin.test(currentUrl)) {
      notify({ msg: `⚠️ Unexpected: ${currentUrl}` });
      await snap("unexpected");
      return;
    }
    notify({ msg: "🔐 At /Login - filling credentials..." });
    await page.fill(SELECTORS.login.username, credentials.username || "");
    notify({ msg: `   Username: ${credentials.username}` });
    await page.fill(SELECTORS.login.password, credentials.password || "");
    notify({
      msg: `   Password: ${"*".repeat((credentials.password || "").length)}`,
    });
    await snap("filled");
    notify({ msg: "🚫 Checking for modal/popup..." });
    try {
      const modal = page.locator("#modal-stuck");
      if (await modal.isVisible({ timeout: 2000 })) {
        notify({ msg: "   Found modal #modal-stuck - closing it..." });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        notify({ msg: "   Modal closed with ESC" });
      }
    } catch (e) {
      notify({ msg: "   No modal found or already closed" });
    }
    await snap("ready-to-submit");
    notify({ msg: "📤 Submitting..." });
    let loginSuccess = false;
    try {
      await page.click(SELECTORS.login.submit);
      await page.waitForURL(isHome, { timeout: 5000 });
      loginSuccess = true;
    } catch (e1) {
      notify({ msg: `   Not redirected yet - checking for alert popup...` });

      // Check for SweetAlert2 "ตกลง" button (first time)
      try {
        const swalButton = page.locator("button.swal2-confirm.swal2-styled");
        if (await swalButton.isVisible({ timeout: 2000 })) {
          notify({
            msg: `   Found confirm button (1st) - clicking...`,
          });
          await swalButton.click();
          await page.waitForTimeout(1000);

          // Try wait for redirect
          try {
            await page.waitForURL(isHome, { timeout: 3000 });
            loginSuccess = true;
            notify({ msg: `   ✅ Redirected after 1st alert` });
          } catch (e2) {
            // Still not redirected, check for second alert
            notify({
              msg: `   Still not redirected - checking for 2nd alert...`,
            });
            if (await swalButton.isVisible({ timeout: 2000 })) {
              notify({
                msg: `   Found confirm button (2nd) - clicking...`,
              });
              await swalButton.click();
              await page.waitForTimeout(1000);

              await page.waitForURL(isHome, { timeout: 10000 });
              loginSuccess = true;
              notify({ msg: `   ✅ Redirected after 2nd alert` });
            } else {
              throw new Error("No 2nd button found");
            }
          }
        } else {
          throw new Error("No button found");
        }
      } catch (e3) {
        notify({ msg: `   Try #2 - using button role...` });
        try {
          await page
            .getByRole("button", { name: /เข้าสู่ระบบ|login|sign.*in/i })
            .click();
          await page.waitForURL(isHome, { timeout: 10000 });
          loginSuccess = true;
        } catch (e4) {
          notify({ msg: `   Try #3 - using Enter key...` });
          try {
            await page.focus(SELECTORS.login.password);
            await page.keyboard.press("Enter");
            await page.waitForURL(isHome, { timeout: 10000 });
            loginSuccess = true;
          } catch (e5) {
            notify({ msg: `   All login attempts failed` });
          }
        }
      }
    }
    await snap("after-submit");
    currentUrl = page.url();
    notify({ msg: `📍 After submit: ${currentUrl}` });
    if (isHome.test(currentUrl)) {
      notify({ msg: "✅ LOGIN SUCCESS" });

      // Click on MenuAbout link
      notify({ msg: `🔗 Looking for MenuAbout button...` });
      try {
        const menuAboutLink = page.locator('a[href="/MenuAbout"]').first();
        if (await menuAboutLink.isVisible({ timeout: 5000 })) {
          notify({ msg: `   Found MenuAbout link - clicking...` });
          await menuAboutLink.click();
          await page.waitForTimeout(2000);
          await snap("menu-about");

          currentUrl = page.url();
          notify({ msg: `📍 Current URL: ${currentUrl}` });
          notify({ msg: "✅ Clicked MenuAbout button" });

          // Click on houseData link
          notify({ msg: `🏠 Looking for houseData button...` });
          const houseDataLink = page.locator('a[href="/houseData"]').first();
          if (await houseDataLink.isVisible({ timeout: 5000 })) {
            notify({ msg: `   Found houseData link - clicking...` });
            await houseDataLink.click();
            await page.waitForTimeout(2000);
            await snap("house-data");

            currentUrl = page.url();
            notify({ msg: `📍 Current URL: ${currentUrl}` });
            notify({ msg: "✅ Clicked houseData button" });

            // Check if we have rows to process (Step 2)
            if (rows && rows.length > 0) {
              notify({
                msg: `📋 Starting Step 2: Processing ${rows.length} rows...`,
              });
              await processRows(page, rows, notify, snap);
            } else {
              notify({ msg: "✅ STEP 1 Complete - Ready for data entry" });
              notify({
                msg: "⏸️ Keeping browser open - waiting for Excel upload...",
              });
              // Don't close browser - keep it open for Step 2
              return { browser, page, context };
            }
          } else {
            notify({ msg: `   ⚠️ houseData button not found` });
          }
        } else {
          notify({ msg: `   ⚠️ MenuAbout button not found` });
        }
      } catch (err) {
        notify({ msg: `   ⚠️ Error: ${err.message}` });
      }
    } else {
      notify({ msg: `❌ LOGIN FAILED` });
    }
  } catch (err) {
    notify({ msg: `❌ Error: ${err.message}` });
    await snap("error");
  } finally {
    await browser.close();
    notify({ msg: "🔚 Done" });
  }
}

async function processRows(page, rows, notify, snap) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      notify({ msg: `📝 Processing row ${rowNum}/${rows.length}...` });
      notify({ msg: `   Data: ${JSON.stringify(row)}` });

      // TODO: Fill form fields based on row data
      // This will be implemented based on the actual form structure

      await page.waitForTimeout(1000);
      await snap(`row-${rowNum}`);

      notify({
        type: "row",
        index: rowNum,
        ok: true,
        data: row,
        note: "สำเร็จ",
      });
    } catch (err) {
      notify({ msg: `   ❌ Error on row ${rowNum}: ${err.message}` });
      notify({
        type: "row",
        index: rowNum,
        ok: false,
        data: row,
        error: err.message,
      });
    }
  }

  notify({ msg: "✅ All rows processed" });
}
module.exports = { runAutomation, SELECTORS };
