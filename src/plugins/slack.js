export default {
  name: "slack",
  displayName: "Slack",
  icon: "#",

  requiredConfig: {
    token: {
      label: "Slack Bot Token (xoxb-...)",
      type: "secret",
      instructions:
        "1. Go to api.slack.com/apps -> Create New App\n" +
        "   2. From Scratch -> name it 'vibenotifications'\n" +
        "   3. OAuth & Permissions -> Add Bot Token Scopes:\n" +
        "      channels:history, channels:read, im:history, im:read, users:read\n" +
        "   4. Install to Workspace\n" +
        "   5. Copy the Bot User OAuth Token (xoxb-...)",
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

    // Fetch recent DMs
    try {
      const convRes = await fetch("https://slack.com/api/conversations.list?types=im&limit=10", {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      const convData = await convRes.json();
      if (convData.ok) {
        for (const channel of convData.channels.slice(0, 5)) {
          const histRes = await fetch(
            `https://slack.com/api/conversations.history?channel=${channel.id}&limit=1`,
            { headers: { Authorization: `Bearer ${config.token}` } }
          );
          const histData = await histRes.json();
          if (histData.ok && histData.messages?.length > 0) {
            const msg = histData.messages[0];
            const age = Date.now() / 1000 - parseFloat(msg.ts);
            if (age < 3600) {
              // Only last hour
              notifications.push({
                id: `slack-${channel.id}-${msg.ts}`,
                source: "slack",
                title: `DM: ${msg.text?.slice(0, 50) || "(attachment)"}`,
                body: msg.text?.slice(0, 200) || "",
                url: `https://app.slack.com`,
                priority: "normal",
                timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
                actionable: false,
              });
            }
          }
        }
      }
    } catch {
      // Silent fail
    }

    return notifications;
  },
};
