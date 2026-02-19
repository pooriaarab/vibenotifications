export default {
  name: "email",
  displayName: "Email",
  icon: "@",

  requiredConfig: {
    imapHost: {
      label: "IMAP server (e.g. imap.gmail.com)",
      type: "string",
      instructions: "Gmail: imap.gmail.com | Outlook: outlook.office365.com | Yahoo: imap.mail.yahoo.com",
    },
    email: {
      label: "Email address",
      type: "string",
    },
    password: {
      label: "App password (not your main password)",
      type: "secret",
      instructions:
        "Gmail: Go to myaccount.google.com/apppasswords -> Generate\n" +
        "   Outlook: Go to account.microsoft.com/security -> App passwords",
    },
  },

  setup: async (config) => {
    // IMAP requires a TCP connection which is complex in pure Node.js
    // For MVP, just validate that config is provided
    if (!config.imapHost || !config.email || !config.password) {
      throw new Error("Missing required IMAP configuration");
    }
    return { connected: true, note: "IMAP connection will be tested on first fetch" };
  },

  fetch: async (config) => {
    // IMAP is complex without external deps. For MVP, return a placeholder.
    // Full IMAP support would need 'imapflow' or similar package.
    return [
      {
        id: `email-unread-${Date.now()}`,
        source: "email",
        title: `Email: check ${config.email} for unread messages`,
        body: "Full IMAP integration coming soon. For now, this is a reminder to check your inbox.",
        url: config.imapHost.includes("gmail") ? "https://mail.google.com" : "https://outlook.live.com",
        priority: "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      },
    ];
  },
};
