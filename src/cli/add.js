import { loadSettings, saveSettings } from "../core/config.js";
import { getPlugin } from "../core/plugins.js";
import { textInput, ANSI } from "./prompts.js";

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

  const settings = loadSettings();
  const pluginConfig = { enabled: true };

  console.log(`${ANSI.bold}Setting up ${plugin.displayName}...${ANSI.reset}`);
  for (const [key, schema] of Object.entries(plugin.requiredConfig)) {
    if (schema.instructions) console.log(`${ANSI.gray}  ${schema.instructions}${ANSI.reset}`);
    const value = await textInput(schema.label, {
      placeholder: schema.placeholder,
      validate: schema.validate,
    });
    pluginConfig[key] = value;
  }

  try {
    const result = await plugin.setup(pluginConfig);
    console.log(`  ${ANSI.green}✓ Connected!${ANSI.reset} ${ANSI.gray}${JSON.stringify(result)}${ANSI.reset}`);
    settings.sources[plugin.name] = pluginConfig;
    saveSettings(settings);
    console.log("  Saved.");
  } catch (err) {
    console.log(`  ${ANSI.red}✗ Failed: ${err.message}${ANSI.reset}`);
  }
}
