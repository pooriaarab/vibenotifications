export default {
  name: "x",
  displayName: "X/Twitter",
  icon: "X",

  requiredConfig: {
    bearerToken: {
      label: "X API Bearer Token",
      type: "secret",
      placeholder: "AAAA...",
      instructions:
        "1. Go to developer.x.com/en/portal/dashboard\n" +
        "   2. Create a project and app\n" +
        "   3. Go to Keys and Tokens\n" +
        "   4. Copy the Bearer Token",
      validate: (value) => {
        if (!value) return "Bearer Token is required.";
        if (value.length < 20) return "Token looks too short. Make sure you copied the full Bearer Token.";
        return null;
      },
    },
    userId: {
      label: "Your X user ID (numeric)",
      type: "string",
      placeholder: "e.g. 1234567890",
      instructions: "Find your user ID at tweeterid.com by entering your @handle",
      validate: (value) => {
        if (!value) return "User ID is required.";
        if (!/^\d+$/.test(value)) {
          return "User ID should be numeric (digits only). Find it at tweeterid.com";
        }
        return null;
      },
    },
  },

  setup: async (config) => {
    const res = await fetch(`https://api.x.com/2/users/${config.userId}`, {
      headers: { Authorization: `Bearer ${config.bearerToken}` },
    });
    if (!res.ok) throw new Error("Invalid X API credentials");
    const data = await res.json();
    return { connected: true, user: data.data?.username };
  },

  fetch: async (config) => {
    const notifications = [];

    try {
      const res = await fetch(
        `https://api.x.com/2/users/${config.userId}/mentions?max_results=10&tweet.fields=created_at,author_id,text`,
        { headers: { Authorization: `Bearer ${config.bearerToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        for (const tweet of data.data || []) {
          notifications.push({
            id: `x-${tweet.id}`,
            source: "x",
            title: `@mention: ${tweet.text?.slice(0, 50)}`,
            body: tweet.text?.slice(0, 200) || "",
            url: `https://x.com/i/status/${tweet.id}`,
            priority: "normal",
            timestamp: tweet.created_at || new Date().toISOString(),
            actionable: false,
          });
        }
      }
    } catch {
      // Silent fail
    }

    return notifications;
  },
};
