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
      host: z.string().describe("Hostname only, e.g. 'forecast.weather.gov'."),
    })).describe("Two to four specific, reputable sites proposed for this category."),
  })).describe("Three to five categories the task needs."),
  stages: z.array(z.string()).describe("Three to five short stage names for this task, in order, ending with 'Done'. Task-specific: a trip might be Explore, Compare, Act, Done; learning might be Read, Check, Notes, Done."),
  cooldownMinutes: z.number().describe("Suggested break after the task, in minutes."),
});

// ---------- The pieces ----------

const Option = z.strictObject({
  id: z.string(),
  name: z.string(),
  facts: z.array(z.string()).describe("Two to four short facts, e.g. '3.1 mi loop'."),
  note: z.string().describe("One line on why it fits, or empty."),
  source,
});

const pieces = [
  z.strictObject({
    type: z.literal("options"),
    title: z.string(),
    items: z.array(Option),
    action: z.string().describe("What choosing does, e.g. 'Shortlist'."),
  }).describe("A list of candidates to choose between or set aside."),
  z.strictObject({
    type: z.literal("compare"),
    title: z.string(),
    columns: z.array(z.strictObject({ id: z.string(), name: z.string() })).describe("Two or three finalists."),
    rows: z.array(z.strictObject({
      label: z.string(),
      cells: z.array(z.strictObject({ text: z.string(), source })).describe("One per column, same order."),
    })),
    action: z.string().describe("What picking a column does, e.g. 'Go with this one'."),
  }).describe("Side-by-side finalists."),
  z.strictObject({
    type: z.literal("facts"),
    title: z.string(),
    items: z.array(z.strictObject({ label: z.string(), text: z.string(), source })),
  }).describe("Key facts about one thing."),
  z.strictObject({
    type: z.literal("text"),
    title: z.string(),
    body: z.string().describe("Short plain paragraphs. No markdown."),
    sources: z.array(source),
  }).describe("A short explanation."),
  z.strictObject({
    type: z.literal("steps"),
    title: z.string(),
    items: z.array(z.strictObject({ text: z.string(), source })),
  }).describe("Ordered steps to carry out, each ticked off."),
  z.strictObject({
    type: z.literal("checklist"),
    title: z.string(),
    items: z.array(z.string()),
  }).describe("Things to bring, buy or prepare."),
  z.strictObject({
    type: z.literal("draft"),
    title: z.string(),
    to: z.string().describe("Recipients, or empty."),
    body: z.string(),
    action: z.string().describe("Button label, e.g. 'Send to group'."),
  }).describe("A message or note the user edits and sends or saves."),
  z.strictObject({
    type: z.literal("poll"),
    question: z.string(),
    options: z.array(z.string()),
  }).describe("A quick question for a group, sent with a draft."),
  z.strictObject({
    type: z.literal("notes"),
    title: z.string(),
    prompt: z.string().describe("What to write, e.g. 'Your decision and why'."),
  }).describe("A space for the user's own words."),
  z.strictObject({
    type: z.literal("reader"),
    url: source,
    why: z.string().describe("Why this page needs reading in full."),
  }).describe("A real page in reader view. Only when the user needs to read or use the page itself."),
];

export const Piece = z.discriminatedUnion("type", pieces);

export const Layout = z.strictObject({
  stage: z.string().describe("Current stage, one of the agreement's stages."),
  headline: z.string().describe("What this screen is for, a few words."),
  pieces: z.array(Piece).describe("One to four pieces, most important first."),
  suggestions: z.array(z.string()).describe("Up to three short things the user might ask next."),
  offPlan: z.array(z.strictObject({ title: z.string(), url: source })).describe("Tempting but off-task links met while researching; the browser offers them for later. Usually empty."),
});

export const Check = z.strictObject({
  verdict: z.enum(["on_task", "detour", "unclear"]),
  reason: z.string().describe("One short sentence for the user."),
});
