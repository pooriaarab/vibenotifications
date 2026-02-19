import { createInterface } from "readline";
import { loadSettings, saveSettings } from "../core/config.js";
import { getPlugin } from "../core/plugins.js";

export async function add(pluginName) {
  if (!pluginName) {
    console.log("Usage: vibenotifications add <plugin>");
    console.log("Plugins: github, slack, x, email, stocks, mcp-bridge");
    return;
  }

  const plugin = await getPlugin(pluginName);
  if (!plugin) {
    console.log(`Unknown plugin: ${pluginName}`);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  const settings = loadSettings();
  const pluginConfig = { enabled: true };

  console.log(`Setting up ${plugin.displayName}...`);
  for (const [key, schema] of Object.entries(plugin.requiredConfig)) {
    if (schema.instructions) console.log(`  ${schema.instructions}`);
    const value = await ask(`  ${schema.label}: `);
    pluginConfig[key] = value.trim();
  }

  try {
    const result = await plugin.setup(pluginConfig);
    console.log(`  Connected! ${JSON.stringify(result)}`);
    settings.sources[plugin.name] = pluginConfig;
    saveSettings(settings);
    console.log("  Saved.");
  } catch (err) {
    console.log(`  Failed: ${err.message}`);
  }

  rl.close();
}
