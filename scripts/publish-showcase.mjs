// Publishes showcase-dist/ to the FOTW prototype host (futureoftheweb.org) and
// prints the share URL. The first run creates the prototype and saves its id
// in scripts/fotw-prototype.json; later runs publish a new version of it.
// Reads FOTW_API_KEY and FOTW_API_URL from the environment; never prints them.
// Usage: node scripts/build-showcase.mjs && node scripts/publish-showcase.mjs
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../..");
const dist = join(root, "showcase-dist");
const idFile = join(root, "scripts/fotw-prototype.json");
const KEY = process.env.FOTW_API_KEY;
const API = (process.env.FOTW_API_URL ?? "https://admin.futureoftheweb.org").replace(/\/$/, "");
if (!KEY) { console.error("FOTW_API_KEY isn't set."); process.exit(1); }
if (!existsSync(dist)) { console.error("Build first: node scripts/build-showcase.mjs"); process.exit(1); }

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml", ".mp4": "video/mp4" };

async function call(method, path, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.error?.code ?? ""} ${data.error?.detail ?? ""}`);
  return data;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(dist).map((full) => {
  const bytes = readFileSync(full);
  return {
    full, bytes,
    path: relative(dist, full).split("\\").join("/"),
    size: bytes.length,
    contentType: TYPES[extname(full)] ?? "application/octet-stream",
    md5: createHash("md5").update(bytes).digest("base64"),
  };
});

const TITLE = "Focus Browser";
const DESCRIPTION = "A browser that asks what you're trying to do, builds the screen that task needs, keeps everything else out, and closes when you're done. A video and a real run.";

let id = existsSync(idFile) ? JSON.parse(readFileSync(idFile, "utf8")).id : null;
if (!id) {
  const created = await call("POST", "/prototypes", {
    title: TITLE,
    kind: "site",
    description: DESCRIPTION,
    access: { mode: "link", defaultRole: "commenter" },
  });
  id = created.id;
  writeFileSync(idFile, JSON.stringify({ id }, null, 2) + "\n");
  console.log(`Created prototype ${id}`);
} else {
  await call("PATCH", `/prototypes/${id}`, { title: TITLE, description: DESCRIPTION });
}

const started = await call("POST", `/prototypes/${id}/versions`, {
  files: files.map(({ path, size, contentType, md5 }) => ({ path, size, contentType, md5 })),
  note: "Showcase: video and a real run",
});
if (started.unchanged) {
  console.log("Nothing changed since the live version.");
} else {
  for (const up of started.uploads ?? []) {
    const file = files.find((f) => f.path === up.path);
    const res = await fetch(up.url, { method: up.method ?? "PUT", headers: up.headers ?? { "content-type": file.contentType }, body: file.bytes });
    if (!res.ok) throw new Error(`Upload of ${up.path} failed: ${res.status}`);
  }
  console.log(`Uploaded ${started.uploads?.length ?? 0} files (${started.reused ?? 0} reused).`);
  await call("POST", `/prototypes/${id}/versions/${started.version.id}/finalize`, { activate: true });
}

const proto = await call("GET", `/prototypes/${id}`);
console.log(`Share URL: ${proto.shareUrl}`);
