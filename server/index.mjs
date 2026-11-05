// Local server for the focus browser. Holds the API key (from the
// environment), so the extension never sees it. Listens on localhost only.
//   node --env-file-if-exists=.env server/index.mjs [--rehearse]
import { createServer } from "node:http";
import { setFocus } from "./focus.mjs";
import { readerView } from "./reader.mjs";
import { SETTINGS } from "./settings.mjs";

const rehearse = process.argv.includes("--rehearse");
const planner = rehearse ? await import("./rehearse.mjs") : await import("./planner.mjs");

const routes = {
  "/api/agreement": ({ intent }) => planner.makeAgreement(String(intent ?? "")),
  "/api/session": ({ agreement }) => ({ id: planner.startSession(agreement) }),
  "/api/step": async ({ id, event }) => ({ layout: await planner.step(id, event), usage: planner.usageOf(id), blocked: planner.blockedOf(id) }),
  "/api/progress": ({ id }) => ({ lines: planner.progressOf?.(id) ?? [] }),
  "/api/check": ({ id, url, title }) => planner.checkLink(id, { url, title }),
  "/api/reader": ({ url }) => readerView(String(url)),
  "/api/focus": ({ on, minutes }) => setFocus(Boolean(on), minutes).then(() => ({ ok: true })),
  "/api/status": () => ({ rehearse, model: rehearse ? null : SETTINGS.model }),
};

createServer(async (req, res) => {
  // Only our extension's pages may call this.
  const origin = req.headers.origin ?? "";
  if (origin && !origin.startsWith("moz-extension://")) { res.writeHead(403).end(); return; }
  res.setHeader("access-control-allow-origin", origin || "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  const route = routes[new URL(req.url, "http://localhost").pathname];
  if (!route || req.method !== "POST") { res.writeHead(404).end(); return; }
  let body = "";
  for await (const chunk of req) body += chunk;
  const started = Date.now();
  try {
    const result = await route(body ? JSON.parse(body) : {});
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
    if (req.url !== "/api/progress") console.log(`${req.url} ${Date.now() - started} ms`);
  } catch (error) {
    console.error(`${req.url} failed:`, error.message);
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: error.message }));
  }
}).listen(SETTINGS.port, "127.0.0.1", () => {
  console.log(`Focus server on http://127.0.0.1:${SETTINGS.port}${rehearse ? " (rehearsal: scripted answers, no API calls)" : ""}`);
});
