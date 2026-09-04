export default {
  name: "slack",
  displayName: "Slack",
  icon: "#",

  requiredConfig: {
    token: {
      label: "Slack Bot Token",
      type: "secret",
      placeholder: "xoxb-...",
      instructions:
        "1. Go to api.slack.com/apps -> Create New App\n" +
        "   2. From Scratch -> name it 'vibenotifications'\n" +
        "   3. OAuth & Permissions -> Add Bot Token Scopes:\n" +
        "      channels:history, channels:read, im:history, im:read, users:read\n" +
        "   4. Install to Workspace\n" +
        "   5. Copy the Bot User OAuth Token (xoxb-...)",
      validate: (value) => {
        if (!value) return "Slack Bot Token is required.";
        if (!value.startsWith("xoxb-")) {
          return "Slack Bot Token should start with 'xoxb-'. Make sure you're copying the Bot User OAuth Token, not the App Token.";
        }
        if (value.length < 30) return "Token looks too short. Make sure you copied the full token.";
        return null;
      },
    },
  },

  setup: async (config) => {
    const res = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack auth failed: ${data.error}`);
    return { connected: true, user: data.user, team: data.team };
  },

  fetch: async (config) => {
    const notifications = [];
    try {
      const channels = await fetchChannels(config.token);
      for (const channel of channels.slice(0, 5)) {
        await processChannel(channel, config.token, notifications);
      }
    } catch {
      // Silent fail
    }
    return notifications;
  },
};

async function fetchChannels(token) {
  const res = await fetch("https://slack.com/api/conversations.list?types=im&limit=10", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json();
  if (!data.ok) return [];
  return data.channels || [];
}

async function processChannel(channel, token, notifications) {
  const histData = await fetchHistory(channel.id, token);
  if (!histData) return;
  const msg = histData.messages?.[0];
  if (!msg) return;
  if (!isRecent(msg)) return;
  notifications.push(buildNotification(channel, msg));
}

async function fetchHistory(channelId, token) {
  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&limit=1`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
  );
  const data = await res.json();
  if (!data.ok) return null;
  return data;
}

function isRecent(msg) {
  const age = Date.now() / 1000 - parseFloat(msg.ts);
  return age < 3600;
}

function buildNotification(channel, msg) {
  return {
    id: `slack-${channel.id}-${msg.ts}`,
    source: "slack",
    title: `DM: ${msg.text?.slice(0, 50) || "(attachment)"}`,
    body: msg.text?.slice(0, 200) || "",
    url: `https://app.slack.com`,
    priority: "normal",
    timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
    actionable: false,
  };
}
