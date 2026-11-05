// Starts the focus browser: the local server, then Firefox full screen in its
// own profile with the extension, on the intent screen.
//   npm start                 real AI (needs ANTHROPIC_API_KEY, or .env)
//   npm start -- --rehearse   scripted answers, no API calls, no cost
//   npm start -- --window     a normal window instead of full screen
//   npm start -- --reset      end any break (cool-down) and clear the saved shelf
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { setFocus } from "../server/focus.mjs";
import { launch, openExtensionPage, pageUrl, root, sleep } from "../tests/lib/firefox.mjs";

const rehearse = process.argv.includes("--rehearse");
const kiosk = !process.argv.includes("--window");
const reset = process.argv.includes("--reset");

const server = spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.mjs", ...(rehearse ? ["--rehearse"] : [])], { cwd: root, stdio: "inherit" });
await sleep(800);

// A profile kept between runs, so the cool-down survives a restart.
const profile = join(root, ".profile");
mkdirSync(profile, { recursive: true });
const { browser, close } = await launch({ kiosk, profile });
const page = await browser.newPage();
await openExtensionPage(page, pageUrl("app/index.html"));
if (reset) {
  await page.evaluate(() => browser.storage.local.remove(["lockUntil", "saved"]));
  await openExtensionPage(page, pageUrl("app/index.html"));
}
for (const p of await browser.pages()) if (p !== page) await p.close().catch(() => {});

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  // Quitting mid-task shouldn't leave Mac Focus on. Fails quietly if the shortcut doesn't exist.
  await setFocus(false).catch(() => {});
  await close();
  server.kill();
  process.exit(0);
};
browser.on("disconnected", stop);
process.on("SIGINT", stop);
