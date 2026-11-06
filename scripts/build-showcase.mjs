// Assembles the shareable Focus Browser page into showcase-dist/: the page
// and run screenshots (showcase/), the demo video and the about page
// (extension/app/about.*). Usage: node scripts/build-showcase.mjs
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../..");
const out = join(root, "showcase-dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "showcase"), out, { recursive: true });
// The demo video lives outside the repo (too large for git): documentation/focus-browser-sm.mp4.
const video = process.env.FOCUS_VIDEO ?? join(root, "../../documentation/focus-browser-sm.mp4");
if (existsSync(video)) cpSync(video, join(out, "media/focus-browser.mp4"));
else console.warn(`No video at ${video}; the page will show its poster only.`);
cpSync(join(root, "extension/app/about.css"), join(out, "about.css"));
// The about page's nav points at the app; here it points back to the showcase.
const about = readFileSync(join(root, "extension/app/about.html"), "utf8")
  .replace('<nav><a href="index.html">Start a task</a></nav>', '<nav><a href="index.html">Back to Focus Browser</a></nav>');
writeFileSync(join(out, "about.html"), about);
console.log(`Built ${out}`);
