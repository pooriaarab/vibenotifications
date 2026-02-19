export default {
  name: "google-calendar",
  displayName: "Google Calendar",
  icon: "GCAL",

  requiredConfig: {
    icsUrl: {
      label: "Google Calendar ICS URL",
      type: "string",
      placeholder: "https://calendar.google.com/calendar/ical/.../basic.ics",
      instructions:
        "Get your private ICS link:\n" +
        "   1. Open Google Calendar > Settings (gear icon)\n" +
        "   2. Click your calendar on the left\n" +
        "   3. Scroll to 'Secret address in iCal format'\n" +
        "   4. Copy the URL",
      validate: (value) => {
        if (!value) return "ICS URL is required.";
        if (!value.startsWith("https://")) return "URL must start with https://";
        if (!value.includes("calendar.google.com") && !value.includes(".ics")) {
          return "This should be a Google Calendar ICS URL (contains calendar.google.com or ends in .ics)";
        }
        return null;
      },
    },
    lookahead: {
      label: "Alert minutes before meeting",
      type: "string",
      placeholder: "10",
      instructions: "How many minutes before a meeting to notify you? (default: 10)",
      validate: (value) => {
        if (!value) return null;
        const n = parseInt(value);
        if (isNaN(n) || n < 1 || n > 120) return "Enter a number between 1 and 120.";
        return null;
      },
    },
  },

  setup: async (config) => {
    try {
      const res = await fetch(config.icsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes("BEGIN:VCALENDAR")) {
        throw new Error("URL does not contain valid calendar data.");
      }
      const nameMatch = text.match(/X-WR-CALNAME:(.*)/);
      const calName = nameMatch ? nameMatch[1].trim() : "Google Calendar";
      return { connected: true, calendar: calName, lookahead: `${parseInt(config.lookahead) || 10}min` };
    } catch (err) {
      throw new Error(`Could not fetch calendar: ${err.message}`);
    }
  },

  fetch: async (config) => {
    const lookahead = parseInt(config.lookahead) || 10;
    return fetchICSEvents(config.icsUrl, lookahead, "google-calendar");
  },
};

async function fetchICSEvents(url, lookahead, source) {
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
        id: `${source}-${event.uid || event.summary.replace(/\s+/g, "-")}-${event.start.toISOString().slice(0, 10)}`,
        source,
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
