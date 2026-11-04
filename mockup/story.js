// Storyboard for the hike demo. Arrow keys or the strip buttons move between
// stages; buttons inside the mockup (Start, the boots link, Send) move it too.

const STAGES = [
  { id: "intent", bar: null, minutes: 25,
    note: "The only thing on screen when Firefox opens. It can't be skipped. Typing a plain sentence is the whole interface." },
  { id: "agreement", bar: null, minutes: 25,
    note: "The intent becomes terms you can edit: what counts as done, the time, the sources allowed and blocked, the cool-down afterwards. Nothing is hidden from you." },
  { id: "explore", bar: "explore", minutes: 22,
    note: "The interface built for this task: a map, one card per trail, a real park page in the panel with the ads and related links removed. The agreement is pinned at the top." },
  { id: "compare", bar: "compare", minutes: 14,
    note: "The interface rebuilds as the question narrows. Three trails get set aside, two finalists move side by side, and Saturday's weather and parking appear." },
  { id: "detour", bar: "compare", minutes: 13,
    note: "An off-plan link asks instead of blocking. Saving it for later puts it on the shelf (top right), so nothing is lost and you stay on task." },
  { id: "act", bar: "act", minutes: 7,
    note: "It ends in something done, not something read: a message drafted from the comparison, a time poll, a short list of things to bring." },
  { id: "done", bar: "done", minutes: 6,
    note: "Done is detected when the message is sent. The end screen says what you did and what's saved, then Firefox closes for the cool-down you chose." },
];

const INTENT = "Plan a hike this Saturday with Sam, Ana and Jo. Under two hours' drive, dog-friendly.";
let index = 0;
let saved = [];
let typing = null;
let countdown = null;

const $ = (s) => document.querySelector(s);

function render() {
  const stage = STAGES[index];
  document.body.dataset.stage = stage.id;
  $(".story-step").textContent = `Stage ${index + 1} of ${STAGES.length} · ${stage.id}`;
  $(".story-note").textContent = stage.note;
  $(".story-prev").disabled = index === 0;
  $(".story-next").disabled = index === STAGES.length - 1;
  $(".timer-min").textContent = stage.minutes;

  // Progress pills: past, current, future.
  const order = ["explore", "compare", "act", "done"];
  const at = order.indexOf(stage.bar);
  document.querySelectorAll(".bar-stages li").forEach((li, i) => {
    li.classList.toggle("past", at > -1 && i < at);
    li.classList.toggle("now", i === at);
  });

  $(".detour").hidden = stage.id !== "detour";
  if (stage.id === "intent") typeIntent(); else finishTyping();
  if (stage.id === "done") startCountdown(); else stopCountdown();
  updateShelf();
}

function typeIntent() {
  clearInterval(typing);
  const el = $(".typed");
  el.textContent = "";
  let i = 0;
  typing = setInterval(() => {
    el.textContent = INTENT.slice(0, ++i);
    if (i >= INTENT.length) clearInterval(typing);
  }, 38);
}
function finishTyping() { clearInterval(typing); $(".typed").textContent = INTENT; }

function startCountdown() {
  stopCountdown();
  let n = 10;
  $(".countdown").textContent = n;
  countdown = setInterval(() => { n = Math.max(0, n - 1); $(".countdown").textContent = n; }, 1000);
}
function stopCountdown() { clearInterval(countdown); }

function updateShelf() {
  const count = $(".shelf-count");
  count.textContent = saved.length;
  $(".shelf-list").textContent = saved.length ? saved.join(", ") : "nothing";
}

function go(id) {
  const i = STAGES.findIndex((s) => s.id === id);
  if (i > -1) { index = i; render(); }
}

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-go], [data-detour], .boots-link, .story-prev, .story-next");
  if (!target) return;
  if (target.matches(".story-prev")) { index = Math.max(0, index - 1); render(); }
  else if (target.matches(".story-next")) { index = Math.min(STAGES.length - 1, index + 1); render(); }
  else if (target.matches(".boots-link")) { e.preventDefault(); go("detour"); }
  else if (target.dataset.go) go(target.dataset.go);
  else if (target.dataset.detour) {
    if (target.dataset.detour === "save" && !saved.includes("Best hiking boots of 2026")) {
      saved.push("Best hiking boots of 2026");
      const count = $(".shelf-count");
      count.classList.add("bump");
      setTimeout(() => count.classList.remove("bump"), 900);
    }
    go("compare");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.isContentEditable || e.target.tagName === "INPUT") return;
  if (e.key === "ArrowRight") { index = Math.min(STAGES.length - 1, index + 1); render(); }
  if (e.key === "ArrowLeft") { index = Math.max(0, index - 1); render(); }
});

// Jump straight to a stage with #compare etc., for screenshots and review.
const hash = location.hash.slice(1);
if (hash) go(hash); else render();
