#!/usr/bin/env node
// PostToolUse hook: increments tool call count for carbon estimation.
// Each tool call ~= 2,000 tokens (input context + tool output + response delta).
// Runs after every Claude Code tool use — lightweight, silent on error.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const SESSION_FILE = join(VN_DIR, "carbon-session.json");

try {
  if (!existsSync(VN_DIR)) mkdirSync(VN_DIR, { recursive: true });

  let session = { startTime: Date.now(), toolCallCount: 0, estimatedTokens: 0 };

  if (existsSync(SESSION_FILE)) {
    try {
      const existing = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
      // Reset if session is more than 8 hours old (new working day)
      if (Date.now() - existing.startTime < 8 * 60 * 60 * 1000) {
        session = existing;
      }
    } catch {
      // Corrupt file — start fresh
    }
  }

  session.toolCallCount = (session.toolCallCount || 0) + 1;
  session.estimatedTokens = session.toolCallCount * 2000;

  writeFileSync(SESSION_FILE, JSON.stringify(session));
} catch {
  // Never crash — hooks must be silent on failure
}
