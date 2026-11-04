// Settings that aren't secret. The API key comes from the environment
// (ANTHROPIC_API_KEY, or .env, which `npm start` loads); it never goes here.
export const SETTINGS = {
  port: Number(process.env.FOCUS_PORT ?? 4747),
  model: process.env.FOCUS_MODEL ?? "claude-opus-5-5",
  // Depth of thinking per call. Agreement and steps are interactive, so the
  // default trades some depth for speed.
  effort: { agreement: "low", step: "medium", check: "low" },
  // Web searches and fetches allowed in one step.
  maxSearches: 5,
  maxFetches: 6,
  // macOS Shortcuts the server runs to switch a Focus mode on and off.
  // Make them once in the Shortcuts app (see README).
  focusOn: "Focus Browser On",
  focusOff: "Focus Browser Off",
};
