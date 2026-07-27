import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin, { parseVibeLine } from "../src/plugins/vibe.js";

test("parseVibeLine: parses a VibeEvent line into a notification", () => {
  const event = {
    kind: "task-done",
    agent: "viberadio",
    cwd: "/repo",
    ts: 1785000000000,
    payload: { summary: "Here is what happened: shipped it." },
  };
  const n = parseVibeLine(JSON.stringify(event), 3);

  assert.equal(n.id, "vibe-1785000000000-task-done-3");
  assert.equal(n.source, "vibe");
  assert.equal(n.title, "viberadio: task done");
  assert.equal(n.body, "Here is what happened: shipped it.");
  assert.equal(n.priority, "normal");
  assert.equal(n.timestamp, new Date(event.ts).toISOString());
  assert.equal(n.actionable, false);
});

test("parseVibeLine: errors are high-priority and actionable", () => {
  const n = parseVibeLine(JSON.stringify({ kind: "error", ts: 1785000000000, payload: { message: "boom" } }));
  assert.equal(n.priority, "high");
  assert.equal(n.actionable, true);
  assert.equal(n.body, "boom");
});

test("parseVibeLine: returns null for malformed lines and non-event JSON", () => {
  assert.equal(parseVibeLine("not json"), null);
  assert.equal(parseVibeLine('{"ts": 1}'), null); // no kind
  assert.equal(parseVibeLine("[1,2,3]"), null);
});

test("parseVibeLine: payload-free events fall back to cwd, missing ts to now", () => {
  const before = Date.now();
  const n = parseVibeLine(JSON.stringify({ kind: "session-end", agent: "pi", cwd: "/repo" }));
  assert.equal(n.body, "in /repo");
  assert.ok(new Date(n.timestamp).getTime() >= before);
});

test("fetch: reads each channel line as a notification", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vibe-plugin-"));
  const file = join(dir, "notify.jsonl");
  try {
    const events = [
      { kind: "task-done", agent: "viberadio", cwd: "/r", ts: Date.now(), payload: { summary: "recap narrated" } },
      { kind: "tests-pass", agent: "pi", cwd: "/r", ts: Date.now(), payload: { count: 5 } },
    ];
    writeFileSync(file, events.map((e) => JSON.stringify(e)).join("\n") + "\n");

    const results = await plugin.fetch({ file });

    assert.equal(results.length, 2);
    assert.equal(results[0].source, "vibe");
    assert.equal(results[0].body, "recap narrated");
    assert.equal(results[1].title, "pi: tests pass");
    // Distinct ids so the daemon dedups correctly.
    assert.notEqual(results[0].id, results[1].id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fetch: returns [] when the channel file does not exist", async () => {
  const results = await plugin.fetch({ file: join(tmpdir(), "vibe-plugin-no-such-file.jsonl") });
  assert.deepEqual(results, []);
});

test("fetch: skips malformed lines and events older than 24h", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vibe-plugin-"));
  const file = join(dir, "notify.jsonl");
  try {
    const stale = { kind: "task-done", ts: Date.now() - 25 * 60 * 60 * 1000 };
    const fresh = { kind: "task-done", ts: Date.now(), payload: { summary: "fresh" } };
    writeFileSync(file, ["garbage line", JSON.stringify(stale), JSON.stringify(fresh)].join("\n"));

    const results = await plugin.fetch({ file });

    assert.equal(results.length, 1);
    assert.equal(results[0].body, "fresh");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup: connects with no configuration", async () => {
  const result = await plugin.setup({ enabled: true });
  assert.equal(result.connected, true);
  assert.deepEqual(plugin.requiredConfig, {});
});
