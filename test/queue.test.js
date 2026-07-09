import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deduplicateNotifications,
  sortByPriority,
  filterByMinPriority,
  trimNotifications,
} from "../src/core/queue.js";

test("deduplicateNotifications: new ids are prepended", () => {
  const existing = [{ id: "a", title: "old" }];
  const incoming = [{ id: "b", title: "new" }];
  const result = deduplicateNotifications(existing, incoming);
  assert.deepEqual(result.map((n) => n.id), ["b", "a"]);
});

test("deduplicateNotifications: matching id upserts in place instead of duplicating", () => {
  const existing = [{ id: "carbon-session", title: "5g" }, { id: "other", title: "x" }];
  const incoming = [{ id: "carbon-session", title: "6g" }];
  const result = deduplicateNotifications(existing, incoming);
  assert.equal(result.length, 2);
  assert.equal(result.find((n) => n.id === "carbon-session").title, "6g");
});

test("deduplicateNotifications: bucketed source ids replace old buckets", () => {
  const existing = [{ id: "stocks-aapl-100", source: "stocks", title: "old" }];
  const incoming = [{ id: "stocks-aapl-101", source: "stocks", title: "new" }];
  const result = deduplicateNotifications(existing, incoming);
  assert.deepEqual(result.map((n) => n.id), ["stocks-aapl-101"]);
});

test("deduplicateNotifications: stable numeric external ids are preserved", () => {
  const existing = [{ id: "github-100", source: "github", title: "old" }];
  const incoming = [{ id: "github-101", source: "github", title: "new" }];
  const result = deduplicateNotifications(existing, incoming);
  assert.deepEqual(result.map((n) => n.id), ["github-101", "github-100"]);
});

test("sortByPriority: urgent before high before normal before low", () => {
  const notifs = [
    { priority: "low", timestamp: "2026-01-01" },
    { priority: "urgent", timestamp: "2026-01-01" },
    { priority: "normal", timestamp: "2026-01-01" },
    { priority: "high", timestamp: "2026-01-01" },
  ];
  const sorted = sortByPriority(notifs);
  assert.deepEqual(sorted.map((n) => n.priority), ["urgent", "high", "normal", "low"]);
});

test("sortByPriority: newer timestamp wins within same priority", () => {
  const notifs = [
    { priority: "normal", timestamp: "2026-01-01T00:00:00Z" },
    { priority: "normal", timestamp: "2026-01-02T00:00:00Z" },
  ];
  const sorted = sortByPriority(notifs);
  assert.equal(sorted[0].timestamp, "2026-01-02T00:00:00Z");
});

test("filterByMinPriority: excludes lower-priority-than-min", () => {
  const notifs = [{ priority: "low" }, { priority: "high" }, { priority: "normal" }];
  const result = filterByMinPriority(notifs, "normal");
  assert.deepEqual(result.map((n) => n.priority), ["high", "normal"]);
});

test("trimNotifications: drops entries older than maxAge and caps count", () => {
  const now = Date.now();
  const notifs = [
    { id: "1", timestamp: new Date(now).toISOString() },
    { id: "2", timestamp: new Date(now - 25 * 60 * 60 * 1000).toISOString() }, // 25h old
  ];
  const result = trimNotifications(notifs, 24 * 60 * 60 * 1000, 100);
  assert.deepEqual(result.map((n) => n.id), ["1"]);
});

test("trimNotifications: maxCount caps the result", () => {
  const now = Date.now();
  const notifs = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    timestamp: new Date(now).toISOString(),
  }));
  const result = trimNotifications(notifs, 24 * 60 * 60 * 1000, 3);
  assert.equal(result.length, 3);
});
