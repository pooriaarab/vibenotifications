export default {
  name: "github",
  displayName: "GitHub",
  icon: "GH",

  requiredConfig: {
    token: {
      label: "GitHub Personal Access Token",
      type: "secret",
      instructions:
        "1. Go to github.com/settings/tokens/new\n" +
        "   2. Name: vibenotifications\n" +
        "   3. Select scopes: notifications, repo\n" +
        "   4. Generate and copy the token",
    },
  },

  setup: async (config) => {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "vibenotifications",
      },
    });
    if (!res.ok) throw new Error("Invalid GitHub token");
    const user = await res.json();
    return { connected: true, user: user.login };
  },

  fetch: async (config) => {
    const res = await fetch("https://api.github.com/notifications", {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "vibenotifications",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return data.map((n) => ({
      id: `github-${n.id}`,
      source: "github",
      title: n.subject.title,
      body: `${n.reason} in ${n.repository.full_name}`,
      url: n.repository.html_url,
      priority: n.reason === "review_requested" || n.reason === "ci_activity" ? "high" : "normal",
      timestamp: n.updated_at,
      actionable: n.reason === "review_requested" || n.reason === "ci_activity",
    }));
  },
};
