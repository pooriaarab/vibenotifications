import { execSync } from "child_process";
import { platform } from "os";

export default {
  name: "calendar",
  displayName: "CalendarPing",
  icon: "CAL",

  requiredConfig: {
    source: {
      label: "Calendar source (macos or ics)",
      type: "string",
      placeholder: "macos",
      instructions:
        "Choose your calendar source:\n" +
        "   macos — Apple Calendar (requires icalBuddy: brew install icalbuddy)\n" +
        "   ics   — Google Calendar, Outlook, or any .ics URL\n" +
        "         (Google: Calendar Settings > calendar > 'Secret address in iCal format')\n" +
        "         (Outlook: Calendar > Settings > Shared calendars > Publish > ICS)",
      validate: (value) => {
        if (!value) return "Enter 'macos' or 'ics'.";
        const v = value.toLowerCase().trim();
        if (v === "macos" || v === "ics") return null;
        return "Enter 'macos' or 'ics'.";
      },
    },
    icsUrl: {
      label: "ICS calendar URL",
      type: "string",
      placeholder: "https://calendar.google.com/calendar/ical/.../basic.ics",
      instructions: "Paste the full .ics URL from your calendar provider.\n   (Skip this if you chose 'macos' above — just press enter)",
      validate: (value) => {
        if (!value) return null; // optional for macos
        if (!value.startsWith("https://")) {
          return "URL must start with https://";
        }
        return null;
      },
    },
    lookahead: {
      label: "Alert minutes before meeting",
      type: "string",
      placeholder: "10",
      instructions: "How many minutes before a meeting should you be notified?",
      validate: (value) => {
        if (!value) return null; // defaults to 10
        const n = parseInt(value);
        if (isNaN(n) || n < 1 || n > 120) {
          return "Enter a number between 1 and 120.";
        }
        return null;
      },
    },
  },

  setup: async (config) => {
    const source = (config.source || "").toLowerCase().trim();
    const lookahead = parseInt(config.lookahead) || 10;

    if (source === "macos") {
      if (platform() !== "darwin") {
        throw new Error("macOS Calendar is only available on macOS.");
      }
      try {
        execSync("which icalBuddy", { stdio: "pipe" });
        return { connected: true, source: "Apple Calendar (icalBuddy)", lookahead: `${lookahead}min` };
      } catch {
        throw new Error(
          "icalBuddy not found. Install it with: brew install icalbuddy"
        );
      }
    }

    if (source === "ics") {
      if (!config.icsUrl) {
        throw new Error("ICS URL is required when source is 'ics'.");
      }
      try {
        const res = await fetch(config.icsUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text.includes("BEGIN:VCALENDAR")) {
          throw new Error("URL does not contain valid ICS data.");
        }
        return { connected: true, source: "ICS feed", lookahead: `${lookahead}min` };
      } catch (err) {
        throw new Error(`Could not fetch calendar: ${err.message}`);
      }
    }

    throw new Error("Choose 'macos' or 'ics' as your calendar source.");
  },

  fetch: async (config) => {
    const source = (config.source || "").toLowerCase().trim();
    const lookahead = parseInt(config.lookahead) || 10;

    if (source === "macos") return fetchMacOSEvents(lookahead);
    if (source === "ics") return fetchICSEvents(config.icsUrl, lookahead);
    return [];
  },
};

function fetchMacOSEvents(lookahead) {
  if (platform() !== "darwin") return [];

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
      const eventId = `calendar-${title.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

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
            continue; // past event
          }
        }
      }

      notifications.push({
        id: eventId,
        source: "calendar",
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
}

async function fetchICSEvents(url, lookahead) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const icsText = await res.text();

    const notifications = [];
    const events = parseICS(icsText);
    const now = Date.now();
    const windowEnd = now + (lookahead + 60) * 60000;

    for (const event of events) {
      if (!event.start || !event.summary) continue;
      const startMs = event.start.getTime();

      if (startMs < now - 5 * 60000 || startMs > windowEnd) continue;

      const minutesUntil = (startMs - now) / 60000;
      let priority = "low";
      let body = "";

      if (minutesUntil <= 5 && minutesUntil > -5) {
        priority = "urgent";
        body = "Starting now!";
      } else if (minutesUntil <= lookahead && minutesUntil > 0) {
        priority = "high";
        body = `In ${Math.round(minutesUntil)} min`;
      } else {
        body = `At ${event.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      }

      if (event.location) body += ` — ${event.location}`;

      notifications.push({
        id: `calendar-ics-${event.uid || event.summary.replace(/\s+/g, "-")}-${event.start.toISOString().slice(0, 10)}`,
        source: "calendar",
        title: `Meeting: ${event.summary}`,
        body: body.trim(),
        url: event.url || "",
        priority,
        timestamp: new Date().toISOString(),
        actionable: priority === "urgent" || priority === "high",
      });
    }

    return notifications;
  } catch {
    return [];
  }
}

function parseICS(text) {
  const events = [];
  const blocks = text.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const event = {};

    const getField = (name) => {
      const match = block.match(new RegExp(`^${name}[;:](.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    event.summary = getField("SUMMARY");
    event.location = getField("LOCATION");
    event.uid = getField("UID");
    event.url = getField("URL");

    const dtstart = getField("DTSTART");
    if (dtstart) event.start = parseICSDate(dtstart);

    if (event.summary && event.start) events.push(event);
  }

  return events;
}

function parseICSDate(str) {
  const clean = str.replace(/^.*:/, "");
  const match = clean.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?(Z)?/);
  if (!match) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = match;
  if (z) return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi), parseInt(s));
}

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
