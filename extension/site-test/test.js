// Site panel test: shows each page in a frame, checks that real content
// loaded, clicks a link inside it, and checks the next page loads in the same
// frame. Results land on window.siteTest for tests/site-pane.mjs to read.
import { SITES } from "./sites.js";

const LOAD_MS = 30_000;
const NAV_MS = 20_000;
const startUrl = location.href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.siteTest = { done: false, results: [] };

// The latest probe and click reply from each frame, keyed by its window.
const latest = new Map();
window.addEventListener("message", (event) => {
  const entry = latest.get(event.source);
  if (!entry) return;
  if (event.data?.focusProbe) entry.probe = { ...event.data.focusProbe, at: Date.now() };
  if ("focusClicked" in (event.data ?? {})) entry.clicked = event.data.focusClicked;
});

async function waitFor(check, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await sleep(250);
  }
  return null;
}

async function run(site) {
  const tile = document.createElement("section");
  tile.className = "tile";
  tile.innerHTML = `<div class="label">${site.name}<small>${site.why}</small></div>`;
  const frame = document.createElement("iframe");
  // No allow-top-navigation: a site can't take over our page.
  frame.sandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
  frame.referrerPolicy = "no-referrer";
  const status = document.createElement("div");
  status.className = "status";
  status.textContent = "Loading…";
  tile.append(frame, status);
  document.getElementById("grid").append(tile);

  const entry = {};
  frame.addEventListener("load", () => latest.set(frame.contentWindow, entry));
  latest.set(frame.contentWindow, entry);
  frame.src = site.url;
  // Keep asking the frame what it shows; only our frame probe answers.
  const ask = setInterval(() => frame.contentWindow?.postMessage({ focusCommand: "probe" }, "*"), 500);

  const result = { name: site.name, url: site.url, why: site.why };
  const first = await waitFor(() => entry.probe, LOAD_MS);
  result.loaded = Boolean(first);
  result.title = first?.title ?? null;
  result.textLength = first?.textLength ?? 0;
  result.botWall = first?.botWall ?? false;
  result.rendered = Boolean(first && first.textLength > 300 && !first.botWall);

  if (result.rendered && first.next) {
    // Let the page settle so its probe reflects the finished page.
    await sleep(1500);
    const before = entry.probe.href;
    frame.contentWindow.postMessage({ focusCommand: "click-next" }, "*");
    result.clicked = await waitFor(() => ("clicked" in entry ? entry.clicked ?? "none" : null), 5000);
    const after = await waitFor(() => (entry.probe && entry.probe.href !== before ? entry.probe : null), NAV_MS);
    result.navigatedTo = after?.href ?? null;
    result.navigated = Boolean(after && after.textLength > 300 && !after.botWall);
  } else {
    result.navigated = false;
    result.clicked = first ? (first.next ? null : "no link found") : null;
  }
  clearInterval(ask);

  result.pass = result.rendered && result.navigated;
  tile.classList.add(result.pass ? "pass" : "fail");
  status.textContent = !result.loaded
    ? "Nothing loaded in the frame."
    : result.botWall
      ? `Bot wall: “${result.title}”`
      : !result.rendered
        ? `Too little content (${result.textLength} chars): “${result.title}”`
        : result.navigated
          ? `Shows “${result.title}”. Click → ${new URL(result.navigatedTo).pathname}`
          : `Shows “${result.title}”. Click didn't load a new page (${result.clicked ?? "no reply"}).`;
  return result;
}

await browser.runtime.sendMessage({ type: "allow-framing" });
const results = await Promise.all(SITES.map(run));
const responses = await browser.runtime.sendMessage({ type: "responses" });
for (const r of results) {
  const host = new URL(r.url).host;
  r.responses = responses.filter((x) => new URL(x.url).host === host);
}
const topStayed = location.href === startUrl;
const passed = results.filter((r) => r.pass).length;
document.getElementById("summary").textContent =
  `${passed} of ${results.length} pass. Our page ${topStayed ? "stayed put" : "was replaced"}.`;
window.siteTest = { done: true, topStayed, results };
