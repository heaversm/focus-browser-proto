// Switches a macOS Focus mode through two shortcuts the person makes once in
// the Shortcuts app. The "on" shortcut receives the minutes as its input.
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SETTINGS } from "./settings.mjs";

function run(args) {
  return new Promise((resolve, reject) => {
    const child = execFile("/usr/bin/shortcuts", args, { timeout: 20_000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(error.killed ? `The shortcut "${args[1]}" didn't finish.` : (stderr || error.message).trim()));
      else resolve(stdout.trim());
    });
    // With no input file, `shortcuts run` waits for input on stdin; give it none.
    child.stdin.end();
  });
}

export async function setFocus(on, minutes = 30) {
  if (process.platform !== "darwin") throw new Error("Focus modes are macOS only.");
  if (!on) return run(["run", SETTINGS.focusOff]);
  const input = join(mkdtempSync(join(tmpdir(), "focus-")), "minutes.txt");
  writeFileSync(input, String(Math.round(minutes)));
  return run(["run", SETTINGS.focusOn, "--input-path", input]);
}
