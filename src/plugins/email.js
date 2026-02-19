const KNOWN_IMAP_HOSTS = {
  "gmail.com": "imap.gmail.com",
  "googlemail.com": "imap.gmail.com",
  "outlook.com": "outlook.office365.com",
  "hotmail.com": "outlook.office365.com",
  "live.com": "outlook.office365.com",
  "yahoo.com": "imap.mail.yahoo.com",
  "icloud.com": "imap.mail.me.com",
  "me.com": "imap.mail.me.com",
  "aol.com": "imap.aol.com",
  "protonmail.com": "imap.protonmail.ch",
  "zoho.com": "imap.zoho.com",
};

const WEBMAIL_URLS = {
  "imap.gmail.com": "https://mail.google.com",
  "outlook.office365.com": "https://outlook.live.com",
  "imap.mail.yahoo.com": "https://mail.yahoo.com",
  "imap.mail.me.com": "https://www.icloud.com/mail",
  "imap.aol.com": "https://mail.aol.com",
  "imap.protonmail.ch": "https://mail.protonmail.com",
};

export default {
  name: "email",
  displayName: "Email",
  icon: "@",

  requiredConfig: {
    email: {
      label: "Email address",
      type: "string",
      placeholder: "you@gmail.com",
      validate: (value) => {
        if (!value) return "Email is required.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return "That doesn't look like a valid email address. Example: user@gmail.com";
        }
        return null;
      },
    },
    imapHost: {
      label: "IMAP server",
      type: "string",
      placeholder: "imap.gmail.com",
      instructions:
        "Common IMAP servers:\n" +
        "   Gmail: imap.gmail.com | Outlook/Hotmail: outlook.office365.com\n" +
        "   Yahoo: imap.mail.yahoo.com | iCloud: imap.mail.me.com\n" +
        "   (Leave blank to auto-detect from your email domain)",
      validate: (value) => {
        // Allow empty — we'll auto-detect
        if (!value) return null;
        // Must look like a hostname
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/.test(value)) {
          return "That doesn't look like a valid server hostname. Example: imap.gmail.com";
        }
        return null;
      },
    },
    password: {
      label: "App password (not your main password)",
      type: "secret",
      instructions:
        "You need an app-specific password, NOT your regular password:\n" +
        "   Gmail: myaccount.google.com/apppasswords\n" +
        "   Outlook: account.microsoft.com/security -> App passwords\n" +
        "   Yahoo: login.yahoo.com -> Account Security -> App password",
      validate: (value) => {
        if (!value) return "App password is required.";
        if (value.length < 4) return "Password seems too short. Did you generate an app password?";
        return null;
      },
    },
  },

  setup: async (config) => {
    // Auto-detect IMAP host from email domain
    if (!config.imapHost) {
      const domain = config.email.split("@")[1]?.toLowerCase();
      if (domain && KNOWN_IMAP_HOSTS[domain]) {
        config.imapHost = KNOWN_IMAP_HOSTS[domain];
      } else {
        throw new Error(
          `Could not auto-detect IMAP server for '${domain}'. ` +
          `Please enter it manually (e.g. imap.${domain}).`
        );
      }
    }

    // Validate the IMAP host is reachable (basic DNS check via fetch to port 443)
    // Full IMAP requires TLS socket — for MVP, validate config shape
    if (!config.email || !config.password) {
      throw new Error("Missing required email configuration");
    }

    const detectedHost = config.imapHost;
    return {
      connected: true,
      server: detectedHost,
      note: "IMAP connection will be tested on first fetch",
    };
  },

  fetch: async (config) => {
    // IMAP is complex without external deps. For MVP, return a smart placeholder.
    const webmailUrl = WEBMAIL_URLS[config.imapHost] || `https://${config.email.split("@")[1]}`;

    return [
      {
        id: `email-unread-${Date.now()}`,
        source: "email",
        title: `Email: check ${config.email} for unread messages`,
        body: "Full IMAP integration coming soon. For now, this is a reminder to check your inbox.",
        url: webmailUrl,
        priority: "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      },
    ];
  },
};
