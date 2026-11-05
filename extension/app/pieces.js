// Draws each piece the AI can choose (server/schema.mjs). Every piece has the
// same flat shape; each type reads only the fields it uses. All model text goes
// in through textContent, never as HTML. Pieces report what the person does
// through ctx.emit(event); sources open in the reader through ctx.open(url).

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) node.append(c);
  return node;
}

function sourceLink(url, ctx) {
  if (!url) return null;
  let host = url;
  try { host = new URL(url).host.replace(/^www\./, ""); } catch {}
  return el("button", { type: "button", class: "src", title: url, onclick: () => ctx.open(url) }, host);
}

const RENDER = {
  options(p, ctx) {
    const chosen = new Set();
    const aside = new Set();
    const foot = el("button", { type: "button", class: "primary", disabled: "" }, `${p.action || "Continue"}`);
    const update = () => {
      foot.disabled = chosen.size === 0;
      foot.textContent = chosen.size ? `${p.action || "Continue"} (${chosen.size})` : p.action || "Continue";
    };
    const rows = p.items.map((item) => {
      const row = el("div", { class: "opt" });
      const pick = el("button", { type: "button", class: "pick", onclick: () => {
        chosen.has(item.id) ? chosen.delete(item.id) : chosen.add(item.id);
        aside.delete(item.id);
        row.classList.toggle("chosen", chosen.has(item.id));
        row.classList.remove("aside");
        update();
      } }, "Pick");
      const drop = el("button", { type: "button", onclick: () => {
        aside.has(item.id) ? aside.delete(item.id) : aside.add(item.id);
        chosen.delete(item.id);
        row.classList.toggle("aside", aside.has(item.id));
        row.classList.remove("chosen");
        update();
      } }, "Set aside");
      row.append(
        el("div", { class: "opt-name" }, item.name),
        el("div", { class: "opt-actions" }, pick, drop),
        el("div", { class: "opt-facts" }, item.facts.map((f) => el("span", {}, f))),
        el("div", { class: "opt-note" }, item.text ? `${item.text} ` : "", sourceLink(item.source, ctx)),
      );
      return row;
    });
    foot.addEventListener("click", () => ctx.emit({
      action: "pick",
      picked: p.items.filter((i) => chosen.has(i.id)).map((i) => i.name),
      setAside: p.items.filter((i) => aside.has(i.id)).map((i) => i.name),
    }));
    return [el("h3", {}, p.title), rows, el("div", { class: "piece-foot" }, foot)];
  },

  compare(p, ctx) {
    const head = el("tr", {}, el("th"), p.columns.map((c) => el("th", { scope: "col" }, c.name)));
    const body = p.rows.map((r) => el("tr", {}, el("th", { scope: "row" }, r.label),
      r.cells.map((c) => el("td", {}, c.text, " ", sourceLink(c.source, ctx)))));
    const foot = el("tr", {}, el("td"), p.columns.map((c) => el("td", {},
      el("button", { type: "button", class: "primary", onclick: () => ctx.emit({ action: "choose", choice: c.name }) }, p.action || "Choose"))));
    return [el("h3", {}, p.title), el("table", { class: "cmp" }, el("thead", {}, head), el("tbody", {}, body), el("tfoot", {}, foot))];
  },

  facts(p, ctx) {
    return [el("h3", {}, p.title), el("dl", { class: "facts" },
      p.items.map((f) => el("div", {}, el("dt", {}, f.name), el("dd", {}, f.text, " ", sourceLink(f.source, ctx)))))];
  },

  text(p, ctx) {
    return [el("h3", {}, p.title), p.body.split(/\n{2,}/).map((para) => el("p", {}, para)),
      el("p", {}, sourceLink(p.url, ctx))];
  },

  steps(p, ctx) {
    return [el("h3", {}, p.title), el("ol", { class: "steps" }, p.items.map((s, i) => el("li", {},
      el("label", {}, el("input", { type: "checkbox", "data-tick": "", onchange: () => ctx.ticked() }), el("span", {}, `${i + 1}. ${s.text} `, sourceLink(s.source, ctx))))))];
  },

  checklist(p, ctx) {
    return [el("h3", {}, p.title), el("ul", { class: "check-list" }, p.items.map((t) => el("li", {},
      el("label", {}, el("input", { type: "checkbox", "data-tick": "", onchange: () => ctx.ticked() }), el("span", {}, t.text, " ", sourceLink(t.source, ctx))))))];
  },

  draft(p, ctx) {
    const body = el("textarea", { class: "draft-body", "aria-label": p.title });
    body.value = p.body;
    const send = el("button", { type: "button", class: "primary", onclick: () => {
      const poll = document.querySelector('input[name="poll"]:checked');
      ctx.emit({ action: "send", to: p.to, body: body.value, poll: poll?.value ?? null });
    } }, p.action || "Send");
    return [el("h3", {}, p.title), p.to ? el("p", { class: "draft-to" }, `To: ${p.to}`) : null, body, el("div", { class: "piece-foot" }, send)];
  },

  poll(p) {
    return [el("h3", {}, p.title), el("div", { class: "poll" }, p.choices.map((o, i) =>
      el("label", {}, el("input", { type: "radio", name: "poll", value: o, ...(i === 0 ? { checked: "" } : {}) }), ` ${o}`)))];
  },

  notes(p, ctx) {
    const box = el("textarea", { class: "notes", placeholder: p.body, "aria-label": p.title });
    return [el("h3", {}, p.title), box, el("div", { class: "piece-foot" },
      el("button", { type: "button", class: "primary", onclick: () => ctx.emit({ action: "note", text: box.value }) }, "Save"))];
  },

  // Not drawn in the grid: opens the reader panel instead.
  reader(p, ctx) {
    ctx.open(p.url);
    return null;
  },
};

const WIDE = new Set(["compare", "options", "steps"]);

/** Replaces the workspace with this layout's pieces. */
export function render(layout, container, ctx) {
  container.replaceChildren();
  for (const piece of layout.pieces) {
    const draw = RENDER[piece.type];
    if (!draw) continue;
    const content = draw(piece, ctx);
    if (!content) continue;
    container.append(el("section", { class: `piece${WIDE.has(piece.type) ? " wide" : ""}`, "data-type": piece.type }, content));
  }
}
