// Scripted answers for running the interface with no API key and no cost:
// `npm start -- --rehearse`. Same shapes as the real planner (schema.mjs);
// sources are real pages, but the content was written by hand.
const OSMP = "https://bouldercolorado.gov/trail/royal-arch";
const NWS = "https://forecast.weather.gov/MapClick.php?lat=39.93&lon=-105.29";
const HP = "https://www.hikingproject.com/trail/7000130/royal-arch";
const CPW = "https://cpw.state.co.us/state-parks/eldorado-canyon-state-park";

export const agreement = {
  goal: "Plan Saturday's hike with Sam, Ana & Jo",
  done: { kind: "send", sentence: "A trail, a start time and a carpool are sent to the group", check: "I'll mark this done when you press Send." },
  minutes: 25,
  looksFor: ["Under 2 hours' drive", "Dogs allowed", "This Saturday"],
  sources: [
    { category: "Trail sites", sites: [{ name: "Boulder Open Space", host: "bouldercolorado.gov" }, { name: "Hiking Project", host: "www.hikingproject.com" }] },
    { category: "Weather", sites: [{ name: "National Weather Service", host: "forecast.weather.gov" }] },
    { category: "Park services", sites: [{ name: "Colorado Parks & Wildlife", host: "cpw.state.co.us" }, { name: "National Park Service", host: "www.nps.gov" }] },
  ],
  stages: ["Explore", "Compare", "Send", "Done"],
  cooldownMinutes: 120,
};

// Fills the fields a piece type doesn't use, so scripted pieces match the schema.
const piece = (p) => ({ title: "", body: "", to: "", action: "", url: "", items: [], columns: [], rows: [], choices: [], ...p });
const item = (p) => ({ id: "", name: "", text: "", facts: [], source: "", ...p });

const explore = {
  stage: "Explore",
  headline: "Three trails that fit",
  pieces: [
    piece({ type: "options", title: "Trails under 2 hours away, dogs allowed", action: "Shortlist", items: [
      item({ id: "royal", name: "Royal Arch", facts: ["3.4 mi", "1,400 ft", "40 min drive"], text: "Steep finish to a stone arch.", source: OSMP }),
      item({ id: "bearpeak", name: "Bear Peak", facts: ["5.6 mi", "2,800 ft", "40 min drive"], text: "Big views, long climb.", source: HP }),
      item({ id: "rattlesnake", name: "Rattlesnake Gulch", facts: ["3.6 mi", "1,000 ft", "45 min drive"], text: "Park fee. Dogs on leash.", source: CPW }),
    ] }),
    piece({ type: "facts", title: "Saturday in Boulder", items: [
      item({ id: "am", name: "Morning", text: "Clear, about 58°F", source: NWS }),
      item({ id: "pm", name: "Afternoon", text: "Wind picks up after 1pm", source: NWS }),
    ] }),
  ],
  suggestions: ["Only loops", "Shorter than 4 miles", "Closer to Denver"],
  offPlan: [{ title: "Best hiking boots of 2026", url: "https://www.rei.com/" }],
};

const compare = {
  stage: "Compare",
  headline: "Two finalists",
  pieces: [
    piece({ type: "compare", title: "Royal Arch or Rattlesnake Gulch", action: "Go with this one",
      columns: [{ id: "royal", name: "Royal Arch" }, { id: "rattlesnake", name: "Rattlesnake Gulch" }],
      rows: [
        { label: "Distance", cells: [{ text: "3.4 mi, 1,400 ft", source: OSMP }, { text: "3.6 mi, 1,000 ft", source: CPW }] },
        { label: "Dogs", cells: [{ text: "On leash", source: OSMP }, { text: "On leash", source: CPW }] },
        { label: "Parking", cells: [{ text: "Chautauqua lot, fills early", source: OSMP }, { text: "Park lot, day fee", source: CPW }] },
      ] }),
  ],
  suggestions: ["Which is better with a dog?", "Where do we park?"],
  offPlan: [],
};

const send = {
  stage: "Send",
  headline: "Send the plan",
  pieces: [
    piece({ type: "draft", title: "Message to the group", to: "Sam, Ana, Jo", action: "Send to group",
      body: "Saturday hike: Royal Arch, 3.4 mi, dogs on leash. Clear morning, windy after 1. The Chautauqua lot fills early, so let's meet at 7:45. I can drive two." }),
    piece({ type: "poll", title: "Start time?", choices: ["7:45", "8:15"] }),
    piece({ type: "checklist", title: "Bring", items: [
      item({ id: "w", text: "Water, 1L each" }), item({ id: "d", text: "Leash and water for the dog" }), item({ id: "l", text: "Wind layer" }),
    ] }),
  ],
  suggestions: [],
  offPlan: [],
};

const script = [explore, compare, send];
const progress = new Map();

export function startSession() {
  const id = crypto.randomUUID();
  progress.set(id, 0);
  return id;
}

export async function step(id, event) {
  await new Promise((r) => setTimeout(r, 600));
  const at = progress.get(id) ?? 0;
  // Asking keeps the current screen; any choice moves on.
  const next = event?.action === "ask" || event?.action === "start" ? at : Math.min(at + 1, script.length - 1);
  progress.set(id, next);
  return script[next];
}

export async function makeAgreement() { return agreement; }
export async function checkLink(_id, { url }) {
  return /rei\.com|boots/i.test(url) ? { verdict: "detour", reason: "Shopping for boots isn't part of planning the hike." } : { verdict: "on_task", reason: "Trail information." };
}
export function usageOf() { return { input: 0, output: 0, searches: 0 }; }
