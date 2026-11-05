// Settings that aren't secret. The API key comes from the environment
// (ANTHROPIC_API_KEY, or .env, which `npm start` loads); it never goes here.
export const SETTINGS = {
  port: Number(process.env.FOCUS_PORT ?? 4747),
  model: process.env.FOCUS_MODEL ?? "claude-opus-5-5",
  // Depth of thinking per call. Agreement and steps are interactive, so the
  // default trades some depth for speed.
  effort: { agreement: "low", step: "medium", check: "low" },
  // Web searches and page reads allowed in one step. Fewer is faster. The
  // first screen gets more room: it runs while the agreement is on screen.
  maxSearches: 3,
  maxFetches: 3,
  firstSearches: 5,
  firstFetches: 4,
  // Most candidates an options piece may list.
  maxOptions: 3,
  // macOS Shortcuts the server runs to switch a Focus mode on and off.
  // Make them once in the Shortcuts app (see README).
  focusOn: "Focus Browser On",
  focusOff: "Focus Browser Off",
};
