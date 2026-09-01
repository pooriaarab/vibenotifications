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
    if (!res.ok)
      throw new Error("Invalid GitHub token — check scopes (needs: notifications, repo)");
    const user = await res.json();
    return { connected: true, user: user.login };
  },

  fetch: async (config) => {
    try {
      const data = await fetchNotifications(config.token);
      return data.map(mapNotification);
    } catch {
      // Silent fail — same pattern as every other plugin's fetch()
      return [];
    }
  },
};

async function fetchNotifications(token) {
  const res = await fetch("https://api.github.com/notifications", {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "vibenotifications",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  return res.json();
}

function getGithubPriority(reason) {
  if (reason === "review_requested" || reason === "ci_activity") return "high";
  return "normal";
}

function isGithubActionable(reason) {
  return reason === "review_requested" || reason === "ci_activity";
}

function mapNotification(n) {
  const reason = n.reason ?? "notification";
  const repoName = n.repository?.full_name ?? "unknown repo";
  return {
    id: `github-${n.id}`,
    source: "github",
    title: n.subject?.title ?? "(no title)",
    body: `${reason} in ${repoName}`,
    url: n.repository?.html_url ?? "",
    priority: getGithubPriority(reason),
    timestamp: n.updated_at,
    actionable: isGithubActionable(reason),
  };
}
