// What the AI may return. The interface is built only from these pieces;
// the AI chooses pieces and fills them, our code draws them.
import { z } from "zod";

const source = z.string().describe("URL of a page actually searched or read this session. Never invented.");

// ---------- The agreement ----------

export const Agreement = z.strictObject({
  goal: z.string().describe("The task in a short, plain sentence, as a heading. Under 60 characters."),
  done: z.strictObject({
    kind: z.enum(["send", "complete", "decide", "ask"]).describe(
      "How the browser can tell the task is done. send: the user sends a drafted message. complete: every item of a checklist or steps piece is ticked. decide: the user picks one option. ask: nothing checkable, so ask the user."),
    sentence: z.string().describe("Done condition in the user's terms, e.g. 'A trail, a start time and a carpool are sent to the group'."),
    check: z.string().describe("What the browser will check, said to the user, e.g. 'I'll mark this done when you press Send.'"),
  }),
  minutes: z.number().describe("Time budget in minutes. Realistic for the task, usually 10 to 45."),
  looksFor: z.array(z.string()).describe("Constraints from the intent, each a few words."),
  sources: z.array(z.strictObject({
    category: z.string().describe("A plain category, e.g. 'Weather'."),
    sites: z.array(z.strictObject({
      name: z.string(),
      host: z.string().describe("Hostname only, e.g. 'forecast.weather.gov'. For health, law, money and elections: official and primary sources first (government, medical institutions, nonpartisan analysts)."),
    })).describe("Two to four specific, reputable sites proposed for this category."),
  })).describe("Three to five categories the task needs."),
  stages: z.array(z.string()).describe("Three to five short stage names for this task, in order, ending with 'Done'. Task-specific: a trip might be Explore, Compare, Act, Done; learning might be Read, Check, Notes, Done."),
  cooldownMinutes: z.number().describe("Suggested break after the task, in minutes."),
});

// ---------- The pieces ----------
// One flat shape for every piece, with a type. A union of ten separate shapes
// compiled to a grammar too large for structured outputs (400, Nov 5 2026).
// Fields a type doesn't use are left empty.

const Item = z.strictObject({
  id: z.string(),
  name: z.string().describe("options: the candidate. facts: the label. Otherwise empty."),
  text: z.string().describe("options: one line on why it fits. facts, steps, checklist: the item itself."),
  facts: z.array(z.string()).describe("options only: two to four short facts, e.g. '3.1 mi loop'."),
  source,
});

export const PIECE_TYPES = ["options", "compare", "facts", "text", "steps", "checklist", "draft", "poll", "notes", "reader"];

export const Piece = z.strictObject({
  type: z.enum(PIECE_TYPES).describe(
    "options: up to three candidates to pick or set aside (items, action). " +
    "compare: two or three things side by side (columns, rows). Set action only when the person should choose one column; for a reference table leave it empty. " +
    "facts: key facts about one thing (items with name and text). " +
    "text: a short explanation (body, url as its source). " +
    "steps: ordered steps to carry out (items with text). " +
    "checklist: things to bring, buy or prepare (items with text). " +
    "draft: a message the person edits and sends (to, body, action). " +
    "poll: a quick question for a group, sent with a draft (title as the question, choices). " +
    "notes: a space for the person's own words (body as the prompt). " +
    "reader: a real page in reader view, only when the person needs the page itself (url, body as why)."),
  title: z.string(),
  body: z.string().describe("Plain text, no markdown. Empty if unused."),
  to: z.string().describe("draft: recipients. Otherwise empty."),
  action: z.string().describe("Button label for options, compare or draft, e.g. 'Shortlist', 'Go with this one', 'Send to group'. Otherwise empty."),
  url: z.string().describe("text: its source. reader: the page. Otherwise empty."),
  items: z.array(Item),
  columns: z.array(z.strictObject({ id: z.string(), name: z.string() })).describe("compare only."),
  rows: z.array(z.strictObject({
    label: z.string(),
    cells: z.array(z.strictObject({ text: z.string(), source })).describe("One per column, same order."),
  })).describe("compare only."),
  choices: z.array(z.string()).describe("poll only."),
});

export const Layout = z.strictObject({
  stage: z.string().describe("Current stage, one of the agreement's stages."),
  headline: z.string().describe("What this screen is for, a few words."),
  pieces: z.array(Piece).describe("One to four pieces, most important first."),
  suggestions: z.array(z.string()).describe("Up to three short things the person might ask next."),
  offPlan: z.array(z.strictObject({ title: z.string(), url: source })).describe("Tempting but off-task links met while researching; the browser offers them for later. Usually empty."),
});

export const Check = z.strictObject({
  verdict: z.enum(["on_task", "detour", "unclear"]),
  reason: z.string().describe("One short sentence for the user."),
});
