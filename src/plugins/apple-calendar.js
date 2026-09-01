import { execSync } from "child_process";
import { platform } from "os";

export default {
  name: "apple-calendar",
  displayName: "Apple Calendar",
  icon: "ICAL",

  requiredConfig: {
    lookahead: {
      label: "Alert minutes before meeting",
      type: "string",
      placeholder: "10",
      instructions:
        "Reads directly from your macOS Calendar app. Requires icalBuddy:\n" +
        "   brew install icalbuddy\n" +
        "   How many minutes before a meeting to notify you? (default: 10)",
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value);
        if (isNaN(n) || n < 1 || n > 120) return "Enter a number between 1 and 120.";
        return null;
      },
    },
  },

  setup: async (config) => {
    if (platform() !== "darwin") {
      throw new Error("Apple Calendar is only available on macOS.");
    }
    try {
      execSync("which icalBuddy", { stdio: "pipe" });
    } catch {
      throw new Error("icalBuddy not found. Install it with: brew install icalbuddy");
    }

    try {
      const calendars = execSync("icalBuddy calendars", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
      }).trim();

      const calCount = calendars.split("\n").filter(Boolean).length;
      return {
        connected: true,
        calendars: `${calCount} calendar(s) found`,
        lookahead: `${parseInt(config.lookahead) || 10}min`,
      };
    } catch {
      return {
        connected: true,
        note: "icalBuddy installed, calendar access may need permissions",
        lookahead: `${parseInt(config.lookahead) || 10}min`,
      };
    }
  },

  fetch: async (config) => {
    if (platform() !== "darwin") return [];
    const lookahead = parseInt(config.lookahead) || 10;
    return fetchAppleEvents(lookahead);
  },
};

function fetchAppleEvents(lookahead) {
  try {
    const output = execSync(`icalBuddy -f -nc -nrd -ea -n -li 10 eventsFrom:today to:today`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    if (!output) return [];
    return parseAppleOutput(output, lookahead);
  } catch {
    return [];
  }
}

function parseAppleOutput(output, lookahead) {
  const notifications = [];
  const lines = output.split("\n").filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const result = processAppleLine(lines[i], lines[i + 1] || "", lookahead);
    if (result) notifications.push(result);
  }
  return notifications;
}

function processAppleLine(line, nextLine, lookahead) {
  const titleMatch = line.match(/^[•\-]\s*(.+?)(?:\s*\(([^)]+)\))?$/);
  if (!titleMatch) return null;
  const title = titleMatch[1].trim();
  const calendar = titleMatch[2] || "";
  const eventId = `apple-calendar-${title.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
  const timeMatch = nextLine.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
  const timing = resolveAppleTiming(timeMatch, calendar, lookahead);
  if (timing === null) return null;
  return {
    id: eventId,
    source: "apple-calendar",
    title: `Meeting: ${title}`,
    body: timing.body.trim(),
    url: "",
    priority: timing.priority,
    timestamp: new Date().toISOString(),
    actionable: timing.priority === "urgent" || timing.priority === "high",
  };
}

function resolveAppleTiming(timeMatch, calendar, lookahead) {
  const priority = "normal";
  const body = calendar ? `Calendar: ${calendar}` : "";
  if (!timeMatch) return { priority, body };
  const eventTime = parseTime(timeMatch[1]);
  if (!eventTime) return { priority, body };
  return evaluateMinutesUntil(eventTime, timeMatch[1], lookahead, body);
}

function evaluateMinutesUntil(eventTime, timeStr, lookahead, baseBody) {
  const minutesUntil = (eventTime - Date.now()) / 60000;
  if (minutesUntil <= 5 && minutesUntil > -5) {
    return { priority: "urgent", body: `Starting now! ${baseBody}` };
  }
  if (minutesUntil <= lookahead && minutesUntil > 0) {
    return { priority: "high", body: `In ${Math.round(minutesUntil)} min. ${baseBody}` };
  }
  if (minutesUntil > lookahead) {
    return { priority: "low", body: `At ${timeStr}. ${baseBody}` };
  }
  return null;
}

function parseTime(str) {
  const match = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3];
  if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
  if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
