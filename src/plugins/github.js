export default {
  name: "github",
  displayName: "GitHub",
  icon: "GH",

  requiredConfig: {
    token: {
      label: "GitHub Personal Access Token",
      type: "secret",
      placeholder: "ghp_... or github_pat_...",
      instructions:
        "1. Go to github.com/settings/tokens/new\n" +
        "   2. Name: vibenotifications\n" +
        "   3. Select scopes: notifications, repo\n" +
        "   4. Generate and copy the token",
      validate: (value) => {
        if (!value) return "Token is required.";
        if (!value.startsWith("ghp_") && !value.startsWith("github_pat_")) {
          return "Token should start with 'ghp_' or 'github_pat_'. Check that you copied the full token.";
        }
        if (value.length < 20) return "Token looks too short. Make sure you copied the full token.";
        return null;
      },
    },
  },

  setup: async (config) => {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "vibenotifications",
      },
    });
    if (!res.ok) throw new Error("Invalid GitHub token — check scopes (needs: notifications, repo)");
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
