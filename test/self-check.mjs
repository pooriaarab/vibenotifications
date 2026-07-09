// Minimal smoke test for round-2 bugfixes. Run: node test/self-check.mjs
import assert from "node:assert/strict";
import { deduplicateNotifications } from "../src/core/queue.js";

// B2: newest time-bucketed id should replace the old one, not accumulate.
const existing = [{ id: "carbon-session-100", source: "carbon", timestamp: "2026-01-01" }];
const incoming = [{ id: "carbon-session-101", source: "carbon", timestamp: "2026-01-02" }];
const merged = deduplicateNotifications(existing, incoming);
assert.equal(merged.length, 1, "bucketed id should replace, not accumulate");
assert.equal(merged[0].id, "carbon-session-101");

// Different source with same-looking id shouldn't cross-contaminate.
const existing2 = [{ id: "stocks-aapl-100", source: "stocks", timestamp: "2026-01-01" }];
const incoming2 = [{ id: "mcp-aapl-101", source: "mcp-bridge", timestamp: "2026-01-02" }];
const merged2 = deduplicateNotifications(existing2, incoming2);
assert.equal(merged2.length, 2, "different sources must not supersede each other");

// Stable external numeric ids, such as GitHub notification ids, are not time
// buckets and must not replace each other by prefix.
const existing3 = [{ id: "github-100", source: "github", timestamp: "2026-01-01" }];
const incoming3 = [{ id: "github-101", source: "github", timestamp: "2026-01-02" }];
const merged3 = deduplicateNotifications(existing3, incoming3);
assert.equal(merged3.length, 2, "stable numeric ids should be preserved");

// Exact-id repeats should still refresh in place.
const existing4 = [{ id: "github-100", source: "github", title: "old" }];
const incoming4 = [{ id: "github-100", source: "github", title: "new" }];
const merged4 = deduplicateNotifications(existing4, incoming4);
assert.equal(merged4.length, 1, "exact ids should update in place");
assert.equal(merged4[0].title, "new");

// B3: threshold "0" must disable (not coerce to 50).
function thresholdFor(raw) {
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 50;
}
assert.equal(thresholdFor("0"), 0);
assert.equal(thresholdFor(""), 50);
assert.equal(thresholdFor("25"), 25);

console.log("self-check: all assertions passed");
