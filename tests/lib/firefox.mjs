// Opens a clean Firefox with the Focus Browser extension installed, the way
// Agent Guard does (../foxpilot/scripts/lib/firefox.mjs). The extension's
// UUID is fixed with a pref, so its page URLs are known before it loads.
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

export const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const EXTENSION = join(root, "extension");
export const FIREFOX = process.env.FIREFOX ?? "/Applications/Firefox.app/Contents/MacOS/firefox";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const manifest = JSON.parse(readFileSync(join(EXTENSION, "manifest.json"), "utf8"));
const id = manifest.browser_specific_settings.gecko.id;
const hex = createHash("sha256").update(id).digest("hex");
export const UUID = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
export const pageUrl = (path) => `moz-extension://${UUID}/${path}`;

// Pass `profile` to keep one between runs; otherwise a fresh one is made and deleted.
export async function launch({ headless = false, kiosk = false, profile: kept } = {}) {
  const profile = kept ?? mkdtempSync(join(tmpdir(), "focus-browser-"));
  const browser = await puppeteer.launch({
    browser: "firefox",
    executablePath: FIREFOX,
    headless,
    userDataDir: profile,
    // BiDi refuses to touch moz-extension: pages without system access.
    // Firefox 159 reads it from the environment; older versions from the flag.
    args: ["-remote-allow-system-access", ...(kiosk ? ["-kiosk"] : [])],
    env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1" },
    defaultViewport: null,
    extraPrefsFirefox: { "extensions.webextensions.uuids": JSON.stringify({ [id]: UUID }) },
  });
  const close = async () => {
    await browser.close().catch(() => {});
    if (!kept) rmSync(profile, { recursive: true, force: true });
  };
  await browser.installExtension(EXTENSION);
  return { browser, close };
}

// BiDi doesn't report navigation events for moz-extension: pages, so goto()
// never resolves there. Start it, then poll until the page is ready.
export async function openExtensionPage(page, url) {
  page.goto(url, { timeout: 0 }).catch(() => {});
  await poll(page, (u) => location.href === u && document.readyState === "complete", url, 30_000);
}

export async function poll(page, fn, arg, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ok = await page.evaluate(fn, arg).catch(() => false);
    if (ok) return ok;
    if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs} ms`);
    await sleep(500);
  }
}
