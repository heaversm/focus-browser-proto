// The test that could end the idea: five very different intents through the
// real AI, each taken two steps in, with a screenshot of every screen. Look
// at whether the screens beat a plain list of links.
// Spends API credit. Usage: npm run test:intents [-- --only=2]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, openExtensionPage, pageUrl, poll, root, sleep } from "./lib/firefox.mjs";

const INTENTS = [
  "Plan a hike this Saturday with Sam, Ana and Jo near Boulder. Under two hours' drive, dog-friendly.",
  "Decide how to vote on the biggest statewide ballot measure in Colorado this year.",
  "My road bike's rear gears skip when I pedal hard. Figure out how to fix it myself.",
  "Find a used Toyota RAV4 hybrid under $25,000 within 50 miles of Denver.",
  "My doctor said I have prediabetes. Understand what that means and what to change.",
];
const stepCount = Number(process.argv.find((a) => a.startsWith("--steps="))?.split("=")[1] ?? 2);
const only = Number(process.argv.find((a) => a.startsWith("--only="))?.split("=")[1] ?? 0);
const out = join(root, "test-results/intents");
mkdirSync(out, { recursive: true });

const server = spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.mjs"], { cwd: root, stdio: "inherit" });
await sleep(800);
const { browser, close } = await launch({ headless: false });
const report = [];
try {
  for (const [i, intent] of INTENTS.entries()) {
    if (only && only !== i + 1) continue;
    const n = i + 1;
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 }).catch(() => {});
    await openExtensionPage(page, pageUrl("app/index.html"));
    const run = (fn, arg) => page.evaluate(fn, arg);
    const shot = async (name) => { await sleep(800); await page.screenshot({ path: join(out, `${n}-${name}.png`), fullPage: true }); };
    const entry = { intent, steps: [] };
    const t0 = Date.now();
    try {
      await run((text) => { document.getElementById("intent-input").value = text; document.getElementById("intent-form").requestSubmit(); }, intent);
      await poll(page, () => document.body.dataset.screen === "agreement" || !document.getElementById("error").hidden, undefined, 120_000);
      entry.agreementMs = Date.now() - t0;
      await run(() => { document.getElementById("ag-focus").checked = false; document.getElementById("ag-cooldown").value = 0; });
      await shot("1-agreement");
      const steps = Array.from({ length: stepCount }, (_, k) => ({ name: `${k + 2}-step${k + 1}` }));
      await run(() => document.getElementById("agreement-form").requestSubmit());
      for (const [k, s] of steps.entries()) {
        const t = Date.now();
        await poll(page, () => document.querySelectorAll("#pieces .piece").length > 0 && !document.body.classList.contains("busy"), undefined, 300_000);
        await shot(s.name);
        const pieces = await run(() => [...document.querySelectorAll("#pieces .piece")].map((p) => p.dataset.type));
        entry.steps.push({ ms: Date.now() - t, headline: await run(() => document.getElementById("headline").textContent), pieces });
        if (k === steps.length - 1) break;
        // Act like a person: pick the first two options, or the first finalist, or ask the first suggestion.
        const sent = await run(() => {
          const draft = document.querySelector('#pieces [data-type="draft"] .primary');
          if (draft) { draft.click(); return true; }
          const picks = document.querySelectorAll("#pieces .pick");
          if (picks.length) { picks[0].click(); picks[1]?.click(); document.querySelector('#pieces [data-type="options"] .piece-foot .primary').click(); return; }
          const choose = document.querySelector("#pieces tfoot .primary");
          if (choose) return choose.click();
          const suggestion = document.querySelector("#suggestions button");
          if (suggestion) return suggestion.click();
          document.getElementById("ask-input").value = "What should I do next?";
          document.getElementById("ask-form").requestSubmit();
        });
        await sleep(500);
        if (sent) {
          await poll(page, () => document.body.dataset.screen === "done", undefined, 10_000).catch(() => {});
          await shot("done");
          entry.done = true;
          break;
        }
      }
    } catch (error) {
      entry.error = error.message;
    }
    entry.error ??= await run(() => document.getElementById("error").hidden ? undefined : document.getElementById("error").textContent).catch(() => undefined);
    report.push(entry);
    console.log(`${n}. ${entry.error ? "FAILED: " + entry.error : entry.steps.map((s) => `${s.headline} [${s.pieces.join(", ")}] ${(s.ms / 1000).toFixed(0)}s`).join("  →  ")}`);
    await page.close();
  }
} finally {
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
  await close();
  server.kill();
}
