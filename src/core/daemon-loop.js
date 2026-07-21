#!/usr/bin/env node

/**
 * Daemon loop script — spawned as a detached background process.
 * Reads fetch interval from settings, calls fetchOnce() in a loop.
 * This is a separate file (not inline eval) to avoid dynamic code execution.
 */

import { loadSettings } from "./config.js";
import { fetchOnce } from "./daemon.js";

async function loop() {
  while (true) {
    // Re-read settings each cycle (not just once at spawn) so a
    // fetchInterval change takes effect on the next tick instead of
    // requiring a manual daemon stop/start.
    const settings = loadSettings();
    const interval = (settings.fetchInterval || 60) * 1000;
    try {
      await fetchOnce();
    } catch (e) {
      console.error(`[${new Date().toISOString()}] vibenotifications daemon error:`, e.message);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

loop();
