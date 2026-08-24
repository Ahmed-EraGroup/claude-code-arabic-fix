// Real Chrome, real layout. jsdom can tell us which attributes we set; only a
// browser can tell us where the text actually ended up on screen.
const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer-core");

const MEDIA = path.join(__dirname, "..", "..", "extension", "media");
const CSS = fs.readFileSync(path.join(MEDIA, "arabic-fix.css"), "utf8");
const JS = fs.readFileSync(path.join(MEDIA, "arabic-fix.js"), "utf8");

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

function findChrome() {
  for (const candidate of CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (e) {}
  }
  return null;
}

// Panel-like chrome around the fixture: the app's own stylesheet ships flex
// message rows, indented tool cards and a composer, and those are exactly the
// things a direction change can wreck.
const PANEL_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; width: 900px; font: 13px/1.4 "Segoe UI", system-ui, sans-serif;
         background: #1f1f1f; color: #ddd; }
  .msgs { display: flex; flex-direction: column; gap: 10px; }
  .row { display: flex; align-items: flex-start; gap: 8px; }
  .userMessageContainer { background: #333; border-radius: 10px; padding: 8px 12px;
                          display: inline-block; max-width: 75%; }
  .tool { border: 1px solid #3a3a3a; border-radius: 8px; background: #252526; margin-left: 24px; }
  .toolhead { display: flex; gap: 8px; align-items: center; padding: 6px 10px; }
  pre { background: #1b1b1b; margin: 0; padding: 8px 10px; overflow-x: auto; }
  code { font-family: Consolas, monospace; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #4a4a4a; padding: 4px 8px; }
  .frag { display: flex; flex-wrap: wrap; }
  .composer { display: flex; align-items: center; gap: 8px; border: 1px solid #555;
              border-radius: 10px; padding: 8px; }
  ul, ol { padding-left: 2em; margin: 4px 0; }
  blockquote { border-left: 2px solid #666; padding-left: 10px; margin: 4px 0; }
`;

let browser = null;

async function getBrowser() {
  if (browser) return browser;
  const executablePath = findChrome();
  if (!executablePath) return null;
  browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  return browser;
}

async function closeBrowser() {
  if (browser) {
    const b = browser;
    browser = null;
    await b.close();
  }
}

/**
 * Renders `html` inside a panel-like page with the real patch applied, then
 * hands the page to the caller for measuring. `vars` overrides the settings
 * the extension normally bakes into the stylesheet.
 */
async function render(html, options = {}) {
  const b = await getBrowser();
  if (!b) return null;
  const page = await b.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.setViewport({ width: 900, height: 900 });

  const css = options.vars ? CSS.replace("/*CAF-VARS*/", options.vars) : CSS;
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8">
     <style>${PANEL_CSS}</style><style>${css}</style></head>
     <body><div class="msgs" id="chat">${html}</div></body></html>`,
    { waitUntil: "load" }
  );
  if (!options.skipPatch) {
    await page.evaluate(JS);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    );
  }

  page.errors = errors;
  // Bounding box of a selector, in page coordinates.
  page.box = (selector) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
               top: Math.round(r.top), bottom: Math.round(r.bottom) };
    }, selector);
  // Where a given substring physically sits — the only honest way to check
  // bidi ordering.
  page.textX = (selector, needle) =>
    page.evaluate(
      (sel, text) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
          const index = node.nodeValue.indexOf(text);
          if (index === -1) continue;
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + text.length);
          const r = range.getBoundingClientRect();
          return { left: Math.round(r.left), right: Math.round(r.right) };
        }
        return null;
      },
      selector,
      needle
    );
  page.style = (selector, prop) =>
    page.evaluate(
      (sel, p) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el)[p] : null;
      },
      selector,
      prop
    );
  page.attr = (selector, name) =>
    page.evaluate(
      (sel, n) => {
        const el = document.querySelector(sel);
        return el ? el.getAttribute(n) : null;
      },
      selector,
      name
    );
  return page;
}

module.exports = { render, closeBrowser, findChrome, JS, CSS };
