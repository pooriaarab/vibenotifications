import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin, { parseOffrouterLine } from "../src/plugins/offrouter.js";

const now = () => new Date().toISOString();

function writeEvents(file) {
  const events = [
    {
      ts: now(),
      type: "route",
      severity: "info",
      provider: "zai",
      model: "glm-5.2",
      profile: "claude-personal",
      home: "personal",
      message: "routed task to glm-5.2",
      meta: {},
    },
    {
      ts: now(),
      type: "near_limit",
      severity: "warn",
      provider: "anthropic",
      model: "claude-sonnet",
      profile: "claude-personal",
      home: "personal",
      message: "Claude usage is near the subscription limit",
      meta: {},
    },
    {
      ts: now(),
      type: "api_key_fallback",
      severity: "info",
      provider: "openrouter",
      model: "moonshotai/kimi-k2",
      profile: "codex-personal",
      home: "personal",
      message: "using API key fallback capacity",
      meta: {},
    },
    {
      ts: now(),
      type: "provider_error",
      severity: "error",
      provider: "openrouter",
      model: "moonshotai/kimi-k2",
      profile: "codex-personal",
      home: "work",
      message: "OpenRouter returned a provider error",
      meta: {},
    },
  ];
  writeFileSync(file, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

test("parseOffrouterLine: parses an OffRouter event line into a notification", () => {
  const event = {
    ts: "2026-07-28T20:00:00.000Z",
    type: "near_limit",
    severity: "warn",
    provider: "anthropic",
    model: "claude-sonnet",
    profile: "claude-personal",
    home: "personal",
    message: "Claude usage is near the subscription limit",
    meta: {},
  };
  const n = parseOffrouterLine(JSON.stringify(event), 4);

  assert.equal(n.id, "offrouter-personal-2026-07-28T20:00:00.000Z-near_limit-4");
  assert.equal(n.source, "offrouter");
  assert.equal(n.title, "! Claude usage is near the subscription limit");
  assert.equal(n.body, "near_limit via claude-personal: anthropic / claude-sonnet");
  assert.equal(n.priority, "high");
  assert.equal(n.timestamp, event.ts);
  assert.equal(n.actionable, true);
});

test("parseOffrouterLine: returns null for malformed or incomplete events", () => {
  assert.equal(parseOffrouterLine("not json"), null);
  assert.equal(parseOffrouterLine('{"ts":"2026-07-28T20:00:00.000Z"}'), null);
  assert.equal(parseOffrouterLine("[1,2,3]"), null);
});

test("fetch: surfaces warn and error events by default and hides route events", async () => {
  const dir = mkdtempSync(join(tmpdir(), "offrouter-plugin-"));
  const file = join(dir, "notify.jsonl");
  try {
    writeEvents(file);

    const results = await plugin.fetch({ homes: [file] });

    assert.equal(results.length, 2);
    assert.deepEqual(
      results.map((n) => n.title),
      ["! Claude usage is near the subscription limit", "x OpenRouter returned a provider error"]
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fetch: surfaces route events when showRoutes is true", async () => {
  const dir = mkdtempSync(join(tmpdir(), "offrouter-plugin-"));
  const file = join(dir, "notify.jsonl");
  try {
    writeEvents(file);

    const results = await plugin.fetch({ homes: [file], showRoutes: true });

    assert.equal(results.length, 3);
    assert.equal(results[0].title, "i routed task to glm-5.2");
    assert.equal(results.some((n) => n.title === "i using API key fallback capacity"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fetch: accepts OffRouter home directories in homes config", async () => {
  const dir = mkdtempSync(join(tmpdir(), "offrouter-plugin-home-dir-"));
  const file = join(dir, "notify.jsonl");
  try {
    writeEvents(file);

    const results = await plugin.fetch({ homes: [dir] });

    assert.equal(results.length, 2);
    assert.equal(results[0].title, "! Claude usage is near the subscription limit");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fetch: respects minSeverity", async () => {
  const dir = mkdtempSync(join(tmpdir(), "offrouter-plugin-"));
  const file = join(dir, "notify.jsonl");
  try {
    writeEvents(file);

    const results = await plugin.fetch({ homes: [file], minSeverity: "error" });

    assert.equal(results.length, 1);
    assert.equal(results[0].title, "x OpenRouter returned a provider error");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fetch: honors OFFROUTER_HOME notify.jsonl by default", async () => {
  const dir = mkdtempSync(join(tmpdir(), "offrouter-plugin-home-"));
  const file = join(dir, "notify.jsonl");
  const previousHome = process.env.OFFROUTER_HOME;
  try {
    process.env.OFFROUTER_HOME = dir;
    writeFileSync(
      file,
      JSON.stringify({
        ts: now(),
        type: "provider_error",
        severity: "error",
        provider: "openrouter",
        model: "moonshotai/kimi-k2",
        profile: "codex-personal",
        home: "personal",
        message: "OFFROUTER_HOME provider error",
        meta: {},
      }) + "\n"
    );

    const results = await plugin.fetch({});

    assert.equal(results.some((n) => n.title === "x OFFROUTER_HOME provider error"), true);
  } finally {
    if (previousHome === undefined) {
      delete process.env.OFFROUTER_HOME;
    } else {
      process.env.OFFROUTER_HOME = previousHome;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fetch: returns [] when configured channel files do not exist", async () => {
  const results = await plugin.fetch({ homes: [join(tmpdir(), "offrouter-plugin-no-such-file.jsonl")] });
  assert.deepEqual(results, []);
});

test("setup: connects with no configuration", async () => {
  const result = await plugin.setup({ enabled: true });
  assert.equal(result.connected, true);
  assert.deepEqual(plugin.requiredConfig, {});
});
