// The AI side: turns an intent into an agreement, and each user action into
// the next screen. Every step is one Claude request that may search and read
// the web, and must answer with a Layout (schema.mjs). The conversation is
// append-only, so earlier turns stay cached.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Agreement, Check, Layout } from "./schema.mjs";
import { SETTINGS } from "./settings.mjs";

const client = new Anthropic();

const AGREEMENT_FORMAT = zodOutputFormat(Agreement);
const LAYOUT_FORMAT = zodOutputFormat(Layout);
const CHECK_FORMAT = zodOutputFormat(Check);

const SYSTEM = `You run the interface of a focus browser. The person said what they want to do; an agreement records the goal, what counts as done, the time and the sources. Your job is to build the best screen for the current step of that task, from a fixed set of pieces, and nothing else.

How to build a screen:
- Pick the fewest pieces that serve this step. Familiar patterns: lists to choose from, a comparison table, a checklist, a message draft. Nothing decorative.
- Drop what no longer matters. When the person narrows down, the rejected options go. Each screen shows only what the current step needs.
- Fill pieces with real, current information. Search and read pages to get it. Every fact carries the URL of a page you actually searched or read in this session; if you can't source a fact, leave it out.
- Search and read only the sites listed in the agreement's sources; the browser enforces this. If they don't have what's needed, say so in a text piece and suggest a site the person could add.
- For health, law, money and elections, rely on official and primary sources (government, medical institutions, nonpartisan analysts), not commercial or personal sites.
- Offer at most three options at a time. Fewer, better candidates beat a long list.
- Searches and page reads are limited per step, so make each count: one well-aimed search per need, then read the best result. If a search or read fails or the limit runs out, build the best screen you can from what you found. Never show a screen about the tools failing when you have usable results.
- Use a reader piece only when the person needs to read or use a page itself. Otherwise summarise into other pieces.
- Move through the agreement's stages as the work progresses. The last working stage should end in something done: a message sent, a decision recorded, steps completed, matching the agreement's done condition.
- If you met tempting but off-task links while researching (shopping, news, unrelated articles), list them in offPlan instead of showing them.
- Keep text short and plain. No markdown.`;

function callClaude(params) {
  return client.beta.messages.create({
    model: SETTINGS.model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...params,
  });
}

function finalJson(response, format) {
  if (response.stop_reason === "refusal") throw new Error(`Declined: ${response.stop_details?.explanation ?? "no reason given"}`);
  if (response.stop_reason === "max_tokens") throw new Error("Ran out of room before finishing the screen.");
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return format.parse(text);
}

/** An intent in plain words → an editable agreement. */
export async function makeAgreement(intent) {
  const response = await callClaude({
    system: SYSTEM,
    output_config: { effort: SETTINGS.effort.agreement, format: AGREEMENT_FORMAT },
    messages: [{ role: "user", content: `Today is ${new Date().toDateString()}. The person typed:\n\n${intent}\n\nDraft the agreement.` }],
  });
  return finalJson(response, AGREEMENT_FORMAT);
}

// Sessions live in memory: one per task.
const sessions = new Map();

export function startSession(agreement) {
  const id = crypto.randomUUID();
  sessions.set(id, { agreement, messages: [], usage: { input: 0, output: 0, searches: 0 }, progress: [] });
  return id;
}

export function usageOf(id) {
  return sessions.get(id)?.usage ?? null;
}

/** What the current step is doing, newest last, for the status bar. */
export function progressOf(id) {
  return sessions.get(id)?.progress ?? [];
}

// The agreement's sites, as plain hostnames for allowed_domains (subdomains are covered).
function allowedDomains(agreement) {
  const hosts = new Set();
  for (const c of agreement.sources ?? []) for (const site of c.sites ?? []) {
    const host = String(site.host ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (host.includes(".")) hosts.add(host);
  }
  return [...hosts].slice(0, 64);
}

// One line per search or page read, as the stream reports them.
function describe(block) {
  if (block.type !== "server_tool_use") return null;
  if (block.name === "web_search") return `Searching “${block.input?.query ?? ""}”`;
  if (block.name === "web_fetch") {
    try { return `Reading ${new URL(block.input?.url).host.replace(/^www\./, "")}`; } catch { return "Reading a page"; }
  }
  return null;
}

/** One user action → the next screen. */
export async function step(id, event) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown session.");
  const first = session.messages.length === 0;
  const text = first
    ? `Today is ${new Date().toDateString()}. The agreement:\n${JSON.stringify(session.agreement, null, 2)}\n\nBuild the first screen.`
    : `The person did this: ${JSON.stringify(event)}\n\nBuild the next screen.`;
  session.messages.push({ role: "user", content: text });

  // Search and reading are limited to the agreement's sites.
  const domains = allowedDomains(session.agreement);
  const limit = domains.length ? { allowed_domains: domains } : {};
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: first ? SETTINGS.firstSearches : SETTINGS.maxSearches, ...limit },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: first ? SETTINGS.firstFetches : SETTINGS.maxFetches, ...limit },
  ];
  session.progress = [first ? "Starting" : "Thinking"];
  // Server tools run on Anthropic's side; a long turn may pause and need resending.
  for (let i = 0; i < 6; i++) {
    const stream = client.beta.messages.stream({
      model: SETTINGS.model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      tools,
      cache_control: { type: "ephemeral" },
      output_config: { effort: SETTINGS.effort.step, format: LAYOUT_FORMAT },
      messages: session.messages,
    });
    stream.on("contentBlock", (block) => {
      const line = describe(block);
      if (line) session.progress.push(line);
      if (block.type === "text") session.progress.push("Building the screen");
    });
    const response = await stream.finalMessage();
    session.usage.input += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0);
    session.usage.output += response.usage.output_tokens;
    session.usage.searches += response.usage.server_tool_use?.web_search_requests ?? 0;
    session.messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;
    const layout = finalJson(response, LAYOUT_FORMAT);
    // Enforce the option cap in code too.
    for (const piece of layout.pieces) if (piece.type === "options") piece.items = piece.items.slice(0, SETTINGS.maxOptions);
    return layout;
  }
  throw new Error("The step kept pausing without finishing.");
}

/** A link the person is about to open → on task, a detour, or unclear. */
export async function checkLink(id, { url, title }) {
  const session = sessions.get(id);
  if (!session) throw new Error("Unknown session.");
  const response = await callClaude({
    output_config: { effort: SETTINGS.effort.check, format: CHECK_FORMAT },
    messages: [{
      role: "user",
      content: `Goal: ${session.agreement.goal}\nLooking for: ${session.agreement.looksFor.join("; ")}\n\nThe person is opening: ${title || "(no title)"} — ${url}\n\nIs this on task for the goal, a detour, or unclear?`,
    }],
  });
  return finalJson(response, CHECK_FORMAT);
}
