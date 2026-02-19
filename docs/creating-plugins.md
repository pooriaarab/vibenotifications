# Creating Plugins

vibenotifications has a simple plugin system. Each plugin is a single JavaScript file in `src/plugins/` that exports a default object with a specific interface.

## Plugin Interface

```javascript
// src/plugins/my-plugin.js
export default {
  // Required: unique identifier (used in settings.json)
  name: "my-plugin",

  // Required: human-readable name (shown in CLI)
  displayName: "My Plugin",

  // Required: short icon text (shown in status line, 1-3 chars)
  icon: "MP",

  // Required: configuration fields the user needs to provide
  // These are prompted during `vibenotifications init` or `vibenotifications add my-plugin`
  requiredConfig: {
    apiKey: {
      label: "API Key",           // shown as the prompt label
      type: "secret",             // "secret" hides input, "string" shows it
      instructions: "Go to ...",  // help text shown before the prompt
    },
    workspace: {
      label: "Workspace ID",
      type: "string",
      instructions: "Find this in your settings at ...",
    },
  },

  // Required: validate credentials and return connection info
  // Called during setup. Throw an error if credentials are invalid.
  setup: async (config) => {
    const res = await fetch("https://api.example.com/me", {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) throw new Error("Invalid API key");
    const user = await res.json();
    return { connected: true, user: user.name };
  },

  // Required: fetch notifications and return an array
  // Called by the daemon on each fetch cycle.
  fetch: async (config) => {
    const res = await fetch("https://api.example.com/notifications", {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();

    return data.items.map((item) => ({
      id: `my-plugin-${item.id}`,          // unique ID for dedup
      source: "my-plugin",                  // matches plugin name
      title: item.title,                    // short title (shown in spinner)
      body: item.description || "",          // longer description
      url: item.link || "",                  // clickable link
      priority: "normal",                    // urgent | high | normal | low
      timestamp: item.created_at,            // ISO 8601 timestamp
      actionable: false,                     // if true, may be injected into Claude's context
    }));
  },
};
```

## Notification Object

Every notification returned from `fetch()` must have these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier. Used for deduplication. Prefix with your plugin name. |
| `source` | string | Plugin name. Must match `name` field. |
| `title` | string | Short title (max ~60 chars). Shown in spinner verbs and status line. |
| `body` | string | Longer description. Shown in dashboard and context injection. |
| `url` | string | Clickable link. Shown as OSC 8 hyperlink in status line. |
| `priority` | string | One of: `urgent`, `high`, `normal`, `low`. Controls which surfaces show it. |
| `timestamp` | string | ISO 8601 timestamp. Used for sorting and expiration (24h default). |
| `actionable` | boolean | If `true`, may be injected into Claude's context for high-priority items. |

## Priority Levels

Priority determines which surfaces show the notification:

| Priority | Spinner | Status Line | Context Injection |
|----------|---------|-------------|-------------------|
| `urgent` | Yes | Yes | Yes |
| `high` | Yes | Yes | Yes |
| `normal` | Yes | Yes | No |
| `low` | No | Yes | No |

These defaults are configurable in `~/.vibenotifications/settings.json`.

## Config Types

| Type | Behavior |
|------|----------|
| `"string"` | Normal text input, visible while typing |
| `"secret"` | Input is hidden (like a password prompt) |

## No API Key? Use `requiredConfig: {}`

If your plugin doesn't need any configuration (like the MCP Bridge plugin), set `requiredConfig` to an empty object:

```javascript
requiredConfig: {},

setup: async () => {
  return { connected: true, note: "No config needed" };
},
```

## Testing Your Plugin

1. Add your plugin file to `src/plugins/`
2. The plugin loader auto-discovers all `.js` files in that directory
3. Run `vibenotifications add my-plugin` to configure it
4. Run `vibenotifications fetch` to test fetching
5. Run `vibenotifications dashboard` to see the notifications

## Tips

- **Silent failures**: Always wrap API calls in try/catch and return `[]` on error. Never let a plugin crash the daemon.
- **Rate limiting**: The daemon calls `fetch()` every 60s by default. Respect API rate limits — cache responses if needed.
- **No external deps**: The core has zero dependencies. Your plugin should use built-in `fetch` (Node 18+). If you need an npm package, consider contributing it as an optional dependency.
- **Dedup IDs**: Make IDs deterministic (e.g., `my-plugin-${item.id}`) so the same notification isn't shown twice.
- **Actionable items**: Set `actionable: true` only for things the user should act on (PR reviews, CI failures). Don't set it for informational items (stock prices, status updates).

## Example: Weather Plugin

A minimal plugin that shows weather as a notification:

```javascript
export default {
  name: "weather",
  displayName: "Weather",
  icon: "WX",

  requiredConfig: {
    city: {
      label: "City name",
      type: "string",
      instructions: "Enter your city name (e.g. San Francisco)",
    },
  },

  setup: async (config) => {
    if (!config.city) throw new Error("City is required");
    return { connected: true, city: config.city };
  },

  fetch: async (config) => {
    try {
      const res = await fetch(
        `https://wttr.in/${encodeURIComponent(config.city)}?format=j1`
      );
      if (!res.ok) return [];
      const data = await res.json();
      const current = data.current_condition[0];

      return [{
        id: `weather-${config.city}-${new Date().toISOString().slice(0, 13)}`,
        source: "weather",
        title: `${config.city}: ${current.temp_F}°F, ${current.weatherDesc[0].value}`,
        body: `Feels like ${current.FeelsLikeF}°F. Humidity: ${current.humidity}%`,
        url: `https://wttr.in/${encodeURIComponent(config.city)}`,
        priority: "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      }];
    } catch {
      return [];
    }
  },
};
```

## Contributing Your Plugin

1. Fork the repo
2. Create `src/plugins/your-plugin.js`
3. Test with `vibenotifications add your-plugin` and `vibenotifications fetch`
4. Submit a PR with a description of what the plugin does
