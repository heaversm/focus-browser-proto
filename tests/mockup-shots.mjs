// Screenshots each stage of the storyboard (mockup/) into test-results/mockup/.
// Usage: npm run shots:mockup
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer";
import { FIREFOX, root, sleep } from "./lib/firefox.mjs";
mkdirSync(`${root}/test-results/mockup`, { recursive: true });
const b = await puppeteer.launch({ browser: "firefox", executablePath: FIREFOX, headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
for (const s of ["intent", "agreement", "explore", "compare", "detour", "act", "done"]) {
  await p.goto(`file://${root}/mockup/index.html#${s}`);
  await p.reload();
  await sleep(s === "intent" ? 3800 : 1500);
  await p.screenshot({ path: `${root}/test-results/mockup/${s}.png` });
}
await b.close();
