// Screenshots the built showcase (showcase-dist/) for a visual check.
// Usage: node scripts/build-showcase.mjs && node tests/showcase-shots.mjs
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer";
import { FIREFOX, root, sleep } from "./lib/firefox.mjs";
mkdirSync(`${root}/test-results/showcase`, { recursive: true });
const b = await puppeteer.launch({ browser: "firefox", executablePath: FIREFOX, headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1366, height: 900 });
await p.goto(`file://${root}/showcase-dist/index.html`);
await sleep(1500);
await p.screenshot({ path: `${root}/test-results/showcase/index.png`, fullPage: true });
await p.click(".next");
await sleep(300);
await p.screenshot({ path: `${root}/test-results/showcase/slide2.png` });
await b.close();
