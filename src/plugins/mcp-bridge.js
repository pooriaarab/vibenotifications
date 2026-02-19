import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export default {
  name: "mcp-bridge",
  displayName: "MCP Bridge",
  icon: "MCP",

  requiredConfig: {},

  setup: async () => {
    const mcpConfig = getMcpConfig();
    if (!mcpConfig) {
      return { connected: true, note: "No MCP servers found. Configure MCPs in Claude Code first." };
    }
    const serverCount = Object.keys(mcpConfig).length;
    return { connected: true, servers: serverCount };
  },

  fetch: async () => {
    const mcpConfig = getMcpConfig();
    if (!mcpConfig) return [];

    const notifications = [];
    const serverNames = Object.keys(mcpConfig);

    for (const name of serverNames) {
      notifications.push({
        id: `mcp-${name}-${Date.now()}`,
        source: "mcp-bridge",
        title: `MCP: ${name} connected`,
        body: `MCP server '${name}' is available`,
        url: "",
        priority: "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      });
    }

    return notifications;
  },
};

function getMcpConfig() {
  const paths = [
    join(homedir(), ".claude", "settings.json"),
    join(homedir(), ".claude", "settings.local.json"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const settings = JSON.parse(readFileSync(p, "utf-8"));
        if (settings.mcpServers && Object.keys(settings.mcpServers).length > 0) {
          return settings.mcpServers;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}
