#!/usr/bin/env node

/**
 * Daemon loop script — spawned as a detached background process.
 * Reads fetch interval from settings, calls fetchOnce() in a loop.
 * This is a separate file (not inline eval) to avoid dynamic code execution.
 */

import { loadSettings } from "./config.js";
import { fetchOnce } from "./daemon.js";

const settings = loadSettings();
const interval = (settings.fetchInterval || 60) * 1000;

async function loop() {
  while (true) {
    try {
      await fetchOnce();
    } catch (e) {
      console.error("vibenotifications daemon error:", e.message);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

loop();
