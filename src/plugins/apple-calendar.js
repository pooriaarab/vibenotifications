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

    try {
      const output = execSync(
        `icalBuddy -f -nc -nrd -ea -n -li 10 eventsFrom:today to:today`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 5000 }
      ).trim();

      if (!output) return [];

      const notifications = [];
      const lines = output.split("\n").filter(Boolean);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const titleMatch = line.match(/^[•\-]\s*(.+?)(?:\s*\(([^)]+)\))?$/);
        if (!titleMatch) continue;

        const title = titleMatch[1].trim();
        const calendar = titleMatch[2] || "";
        const eventId = `apple-calendar-${title.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

        const timeLine = lines[i + 1] || "";
        const timeMatch = timeLine.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
        let priority = "normal";
        let body = calendar ? `Calendar: ${calendar}` : "";

        if (timeMatch) {
          const eventTime = parseTime(timeMatch[1]);
          if (eventTime) {
            const minutesUntil = (eventTime - Date.now()) / 60000;
            if (minutesUntil <= 5 && minutesUntil > -5) {
              priority = "urgent";
              body = `Starting now! ${body}`;
            } else if (minutesUntil <= lookahead && minutesUntil > 0) {
              priority = "high";
              body = `In ${Math.round(minutesUntil)} min. ${body}`;
            } else if (minutesUntil > lookahead) {
              priority = "low";
              body = `At ${timeMatch[1]}. ${body}`;
            } else {
              continue;
            }
          }
        }

        notifications.push({
          id: eventId,
          source: "apple-calendar",
          title: `Meeting: ${title}`,
          body: body.trim(),
          url: "",
          priority,
          timestamp: new Date().toISOString(),
          actionable: priority === "urgent" || priority === "high",
        });
      }

      return notifications;
    } catch {
      return [];
    }
  },
};

function parseTime(str) {
  const match = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let [, h, m, ampm] = match;
  h = parseInt(h);
  m = parseInt(m);
  if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
  if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}
