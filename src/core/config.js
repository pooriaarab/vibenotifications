import { readFileSync, mkdirSync, existsSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { atomicWriteFileSync } from "./atomic-write.js";

const VN_DIR = join(homedir(), ".vibenotifications");
const SETTINGS_FILE = join(VN_DIR, "settings.json");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");
let warnedSettingsParse = false;
let warnedNotificationsParse = false;

export { VN_DIR, SETTINGS_FILE, NOTIFICATIONS_FILE };

export function ensureDir() {
  if (!existsSync(VN_DIR)) {
    mkdirSync(VN_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadSettings() {
  ensureDir();
  if (!existsSync(SETTINGS_FILE)) {
    return getDefaultSettings();
  }
  try {
    chmodSync(SETTINGS_FILE, 0o600);
  } catch {
    // best-effort permission migration
  }
  const d = getDefaultSettings();
  try {
    const s = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
    return {
      ...d,
      ...s,
      surfaces: { ...d.surfaces, ...s.surfaces },
      priority: { ...d.priority, ...s.priority },
    };
  } catch {
    if (!warnedSettingsParse) {
      console.error("vibenotifications: settings.json is unreadable; using defaults.");
      warnedSettingsParse = true;
    }
    return d;
  }
}

export function saveSettings(settings) {
  ensureDir();
  atomicWriteFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

export function getDefaultSettings() {
  return {
    version: "0.1.0",
    fetchInterval: 60,
    sources: {},
    surfaces: {
      spinnerVerbs: { enabled: true, maxLength: 60 },
      statusLine: { enabled: true },
      contextInjection: { enabled: true, rate: 0.3 },
      sessionSummary: { enabled: true },
    },
    priority: {
      minSpinner: "normal",
      minStatusLine: "low",
      minContextInjection: "high",
    },
  };
}

export function loadNotifications() {
  ensureDir();
  if (!existsSync(NOTIFICATIONS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(NOTIFICATIONS_FILE, "utf-8"));
  } catch {
    if (!warnedNotificationsParse) {
      console.error("vibenotifications: notifications.json is unreadable; using an empty queue.");
      warnedNotificationsParse = true;
    }
    return [];
  }
}

export function saveNotifications(notifications) {
  ensureDir();
  atomicWriteFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), { mode: 0o600 });
}
