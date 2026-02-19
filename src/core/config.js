import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const VN_DIR = join(homedir(), ".vibenotifications");
const SETTINGS_FILE = join(VN_DIR, "settings.json");
const NOTIFICATIONS_FILE = join(VN_DIR, "notifications.json");

export { VN_DIR, SETTINGS_FILE, NOTIFICATIONS_FILE };

export function ensureDir() {
  if (!existsSync(VN_DIR)) {
    mkdirSync(VN_DIR, { recursive: true });
  }
}

export function loadSettings() {
  ensureDir();
  if (!existsSync(SETTINGS_FILE)) {
    return getDefaultSettings();
  }
  return JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
}

export function saveSettings(settings) {
  ensureDir();
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
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
  return JSON.parse(readFileSync(NOTIFICATIONS_FILE, "utf-8"));
}

export function saveNotifications(notifications) {
  ensureDir();
  writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
}
