// The focus browser's one page: intent → agreement → workspace → done → cool-down.
// The AI lives behind the local server (server/index.mjs); this page draws
// what it returns and enforces the agreement in code: the clock, the sources,
// the done condition, the cool-down.
import { render } from "./pieces.js";

const SERVER = "http://127.0.0.1:4747";
const $ = (id) => document.getElementById(id);

const state = {
  intent: "",
  agreement: null,
  session: null,
  layout: null,
  started: 0,
  deadline: 0,
  extended: false,
  saved: [],        // { title, url }
  readerUrl: null,
  focusOn: false,
  log: [],          // what happened, for the end screen and for debugging
};

// ---------- helpers ----------

async function api(path, body) {
  const response = await fetch(`${SERVER}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).catch(() => { throw new Error("The focus server isn't running. Start it with npm start."); });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Server error ${response.status}`);
  return data;
}

function showError(error) {
  const box = $("error");
  box.textContent = error.message ?? String(error);
  box.hidden = false;
  setTimeout(() => (box.hidden = true), 7000);
}

function screen(name) { document.body.dataset.screen = name; }

const hostOf = (url) => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return ""; } };
const clockTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function busy(on, text = "Working on it…") {
  document.body.classList.toggle("busy", on);
  $("working").hidden = !on;
  $("working-text").textContent = text;
}

// ---------- start: cool-down or intent ----------

async function boot() {
  // Let real sites show in frames inside this tab (background.js).
  browser.runtime.sendMessage({ type: "allow-framing" }).catch(() => {});
  const { lockUntil = 0, saved = [] } = await browser.storage.local.get(["lockUntil", "saved"]);
  state.saved = saved;
  if (lockUntil > Date.now()) return showCooldown(lockUntil);
  screen("intent");
  $("intent-input").focus();
  const status = await api("/api/status").catch(() => null);
  if (status?.rehearse) $("intent-hint").textContent = "Rehearsal: scripted answers, no AI.";
}

function showCooldown(until) {
  $("cool-until").textContent = clockTime(until);
  $("cool-saved").textContent = state.saved.length ? `Saved for later: ${state.saved.map((s) => s.title).join(", ")}` : "";
  screen("cooldown");
  setTimeout(() => location.reload(), Math.min(until - Date.now() + 500, 2 ** 31 - 1));
}

// ---------- intent → agreement ----------

$("intent-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  state.intent = $("intent-input").value.trim();
  if (!state.intent) return;
  $("intent-hint").textContent = "Drafting a plan…";
  try {
    state.agreement = await api("/api/agreement", { intent: state.intent });
    fillAgreement();
    screen("agreement");
  } catch (error) {
    showError(error);
    $("intent-hint").textContent = "Firefox opens here every time. Everything else waits until you say.";
  }
});

function fillAgreement() {
  const a = state.agreement;
  $("ag-goal").textContent = a.goal;
  $("ag-done").textContent = a.done.sentence;
  $("ag-check").textContent = a.done.check;
  $("ag-minutes").value = a.minutes;
  $("ag-looks").textContent = a.looksFor.join(" · ");
  $("ag-cooldown").value = a.cooldownMinutes;
  // Every proposed site starts on; clicking a category turns it off, a site toggles alone.
  for (const cat of a.sources) for (const s of cat.sites) s.on ??= true;
  drawSources();
  updateBy();
}

function drawSources() {
  const box = $("ag-sources");
  box.replaceChildren();
  for (const cat of state.agreement.sources) {
    const row = document.createElement("div");
    row.className = "source-cat";
    const anyOn = cat.sites.some((s) => s.on);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `cat${anyOn ? "" : " off"}`;
    chip.textContent = cat.category;
    chip.title = anyOn ? "Turn this category off" : "Turn this category on";
    chip.addEventListener("click", () => { for (const s of cat.sites) s.on = !anyOn; drawSources(); });
    const sites = document.createElement("span");
    sites.className = "sites";
    for (const s of cat.sites) {
      const label = document.createElement("label");
      label.className = "site";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = s.on;
      box.addEventListener("change", () => { s.on = box.checked; drawSources(); });
      label.append(box, s.name);
      label.title = s.host;
      sites.append(label);
    }
    row.append(chip, sites);
    box.append(row);
  }
}

$("ag-add-btn").addEventListener("click", () => {
  const raw = $("ag-add").value.trim();
  if (!raw) return;
  const host = hostOf(raw.includes("://") ? raw : `https://${raw}`) || raw;
  let mine = state.agreement.sources.find((c) => c.category === "Added by you");
  if (!mine) state.agreement.sources.push((mine = { category: "Added by you", sites: [] }));
  mine.sites.push({ name: host, host, on: true });
  $("ag-add").value = "";
  drawSources();
});

function updateBy() { $("ag-by").textContent = clockTime(Date.now() + Number($("ag-minutes").value) * 60_000); }
$("ag-minutes").addEventListener("input", updateBy);

function readAgreement() {
  const a = state.agreement;
  a.goal = $("ag-goal").textContent.trim();
  if ($("ag-done").textContent.trim() !== a.done.sentence) {
    // An edited done condition: tell the AI, and fall back to asking until it's re-read.
    a.done = { kind: "ask", sentence: $("ag-done").textContent.trim(), check: "I'll ask you when this looks done." };
  }
  a.minutes = Number($("ag-minutes").value) || a.minutes;
  a.looksFor = $("ag-looks").textContent.split("·").map((s) => s.trim()).filter(Boolean);
  a.cooldownMinutes = Number($("ag-cooldown").value) || 0;
  a.sources = a.sources.map((c) => ({ ...c, sites: c.sites.filter((s) => s.on) })).filter((c) => c.sites.length);
  return a;
}

// ---------- agreement → workspace ----------

$("agreement-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const agreement = readAgreement();
  try {
    const { id } = await api("/api/session", { agreement });
    state.session = id;
  } catch (error) { return showError(error); }
  state.started = Date.now();
  state.deadline = state.started + agreement.minutes * 60_000;
  drawBar();
  screen("work");
  tick();
  if ($("ag-focus").checked) {
    api("/api/focus", { on: true, minutes: agreement.minutes + 5 })
      .then(() => { state.focusOn = true; $("focus-chip").hidden = false; })
      .catch((error) => showError(new Error(`Mac Focus didn't turn on: ${error.message}`)));
  }
  await next({ action: "start" });
});

function drawBar() {
  $("bar-goal").textContent = state.agreement.goal;
  const stages = $("bar-stages");
  stages.replaceChildren();
  const at = state.agreement.stages.indexOf(state.layout?.stage ?? state.agreement.stages[0]);
  state.agreement.stages.forEach((name, i) => {
    const li = document.createElement("li");
    li.textContent = name;
    if (i < at) li.className = "past";
    if (i === at) li.className = "now";
    stages.append(li);
  });
  $("shelf-count").textContent = state.saved.length;
}

async function next(event) {
  state.log.push({ at: Date.now(), ...event });
  busy(true, event.action === "start" ? "Finding what you need…" : "Updating…");
  try {
    const { layout } = await api("/api/step", { id: state.session, event });
    state.layout = layout;
    for (const link of layout.offPlan ?? []) addSaved(link, "found while researching");
    // A new screen drops the page from the last one, unless this screen asks for a page.
    if (!layout.pieces.some((p) => p.type === "reader")) { $("reader").hidden = true; state.readerUrl = null; }
    $("headline").textContent = layout.headline;
    render(layout, $("pieces"), ctx);
    drawSuggestions(layout.suggestions ?? []);
    drawBar();
  } catch (error) {
    showError(error);
  } finally {
    busy(false);
  }
}

const ctx = {
  emit(event) {
    if (event.action === "send" && state.agreement.done.kind === "send") return finish(event);
    if (event.action === "choose" && state.agreement.done.kind === "decide") return finish(event);
    next(event);
  },
  open: (url) => openReader(url),
  ticked() {
    const boxes = [...document.querySelectorAll("#pieces [data-tick]")];
    if (state.agreement.done.kind === "complete" && boxes.length && boxes.every((b) => b.checked)) finish({ action: "complete" });
  },
};

function drawSuggestions(list) {
  const box = $("suggestions");
  box.replaceChildren();
  for (const s of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    b.addEventListener("click", () => next({ action: "ask", text: s }));
    box.append(b);
  }
}

$("ask-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("ask-input").value.trim();
  if (!text) return;
  $("ask-input").value = "";
  next({ action: "ask", text });
});

// ---------- the reader panel: only when a page is needed ----------

function allowed(url) {
  const host = hostOf(url);
  return state.agreement.sources.some((c) => c.sites.some((s) => host === s.host.replace(/^www\./, "") || host.endsWith(`.${s.host.replace(/^www\./, "")}`)));
}

async function openReader(url, { original = false } = {}) {
  state.readerUrl = url;
  $("reader").hidden = false;
  $("reader-host").textContent = hostOf(url);
  $("reader-original").textContent = original ? "Reader view" : "Show original";
  const frame = $("reader-frame");
  if (original) {
    frame.removeAttribute("srcdoc");
    frame.sandbox = "allow-scripts allow-same-origin allow-forms";
    frame.src = url;
    return;
  }
  frame.removeAttribute("src");
  // No scripts in reader view; same origin so this page can catch link clicks.
  frame.sandbox = "allow-same-origin";
  frame.srcdoc = `<p style="font:15px sans-serif;color:#5a615b;padding:20px">Loading…</p>`;
  try {
    const article = await api("/api/reader", { url });
    frame.srcdoc = readerDoc(article);
    frame.onload = () => frame.contentDocument?.addEventListener("click", onReaderClick);
  } catch (error) {
    frame.srcdoc = `<p style="font:15px sans-serif;color:#9a4b2a;padding:20px">${escapeHtml(error.message)} Try “Show original”.</p>`;
  }
}

function readerDoc(a) {
  return `<!doctype html><meta charset="utf-8"><base href="${escapeHtml(a.url)}">
<style>body{font:17px/1.6 "Iowan Old Style",Georgia,serif;color:#1f2420;max-width:640px;margin:0 auto;padding:24px 28px}
h1{font-size:26px;line-height:1.2}img{max-width:100%;height:auto}a{color:#2f5d46}.by{font:13px sans-serif;color:#5a615b}</style>
<h1>${escapeHtml(a.title ?? "")}</h1><p class="by">${escapeHtml([a.siteName, a.byline].filter(Boolean).join(" · "))}</p>${a.content}`;
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

// Links inside a page: allowed sources open in place; anything else is checked.
async function onReaderClick(e) {
  const a = e.target.closest?.("a[href]");
  if (!a) return;
  e.preventDefault();
  const url = a.href;
  if (url.split("#")[0] === state.readerUrl?.split("#")[0]) return;
  if (allowed(url)) return openReader(url);
  try {
    const verdict = await api("/api/check", { id: state.session, url, title: a.textContent.trim() });
    if (verdict.verdict === "on_task") return openReader(url);
    askDetour({ title: a.textContent.trim() || hostOf(url), url }, verdict.reason);
  } catch (error) { showError(error); }
}

$("reader-close").addEventListener("click", () => { $("reader").hidden = true; state.readerUrl = null; });
$("reader-original").addEventListener("click", () => {
  const original = $("reader-original").textContent === "Show original";
  openReader(state.readerUrl, { original });
});

// ---------- detours and the saved shelf ----------

let pendingDetour = null;
function askDetour(link, reason) {
  pendingDetour = link;
  $("detour-title").textContent = `“${link.title}” isn't part of the plan.`;
  $("detour-reason").textContent = reason ?? "";
  $("detour").hidden = false;
}

$("detour").addEventListener("click", (e) => {
  const choice = e.target.dataset?.detour;
  if (!choice) return;
  $("detour").hidden = true;
  if (choice === "save") addSaved(pendingDetour, "you saved");
  if (choice === "quick") {
    openReader(pendingDetour.url);
    setTimeout(() => { if (state.readerUrl === pendingDetour?.url) { $("reader").hidden = true; addSaved(pendingDetour, "quick look ended"); } }, 3 * 60_000);
  }
  state.log.push({ at: Date.now(), action: `detour-${choice}`, url: pendingDetour?.url });
});

function addSaved(link, why) {
  if (!link?.url || state.saved.some((s) => s.url === link.url)) return;
  state.saved.push({ title: link.title, url: link.url, why });
  browser.storage.local.set({ saved: state.saved });
  $("shelf-count").textContent = state.saved.length;
}

$("shelf-btn").addEventListener("click", () => {
  const list = $("shelf-list");
  list.replaceChildren();
  if (!state.saved.length) list.append(Object.assign(document.createElement("li"), { textContent: "Nothing yet." }));
  for (const s of state.saved) list.append(Object.assign(document.createElement("li"), { textContent: `${s.title} — ${hostOf(s.url)}` }));
  $("shelf").hidden = false;
});
$("shelf-close").addEventListener("click", () => ($("shelf").hidden = true));

// ---------- I'm blocked ----------

$("blocked-btn").addEventListener("click", () => { $("blocked").hidden = false; $("blocked-input").focus(); });
$("blocked-cancel").addEventListener("click", () => ($("blocked").hidden = true));
$("blocked-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("blocked-input").value.trim();
  $("blocked").hidden = true;
  $("blocked-input").value = "";
  next({ action: "blocked", text });
});

// ---------- the clock ----------

let clockTimer = null;
function tick() {
  clearInterval(clockTimer);
  const draw = () => {
    const left = Math.max(0, Math.ceil((state.deadline - Date.now()) / 60_000));
    $("clock").innerHTML = `<b>${left}</b> min left · by ${clockTime(state.deadline)}`;
    $("clock").classList.toggle("low", left <= 5);
    if (Date.now() >= state.deadline && document.body.dataset.screen === "work" && $("timeup").hidden) {
      $("timeup-extend").hidden = state.extended;
      $("timeup-title").textContent = state.extended ? "That's the time. Stop here?" : "Wrap up, or stop here?";
      $("timeup").hidden = false;
    }
  };
  draw();
  clockTimer = setInterval(draw, 5000);
}
$("timeup-extend").addEventListener("click", () => {
  state.extended = true;
  state.deadline = Date.now() + 5 * 60_000;
  $("timeup").hidden = true;
});
$("timeup-stop").addEventListener("click", () => { $("timeup").hidden = true; finish({ action: "stopped" }); });

// ---------- done and cool-down ----------

async function finish(event) {
  state.log.push({ at: Date.now(), ...event });
  clearInterval(clockTimer);
  const minutes = Math.max(1, Math.round((Date.now() - state.started) / 60_000));
  const stopped = event.action === "stopped";
  $("done-eyebrow").textContent = `${stopped ? "Stopped" : "Done"} · ${minutes} minute${minutes === 1 ? "" : "s"}`;
  $("done-title").textContent = stopped ? "Good place to stop." : "Nice work.";
  $("done-what").textContent = stopped ? "" : state.agreement.done.sentence;
  $("done-saved").textContent = state.saved.length ? `Saved for later: ${state.saved.map((s) => s.title).join(", ")}` : "";
  screen("done");
  if (state.focusOn) api("/api/focus", { on: false }).catch(() => {});
  const cool = state.agreement.cooldownMinutes;
  if (!cool) { $("done-close").textContent = ""; return; }
  const until = Date.now() + cool * 60_000;
  await browser.storage.local.set({ lockUntil: until });
  let n = 10;
  const count = () => { $("done-close").textContent = `Firefox closes in ${n}s and opens again at ${clockTime(until)}.`; };
  count();
  const timer = setInterval(() => {
    n -= 1;
    count();
    if (n <= 0) { clearInterval(timer); browser.runtime.sendMessage({ type: "close-window" }).catch(() => showCooldown(until)); }
  }, 1000);
}

boot().catch(showError);
