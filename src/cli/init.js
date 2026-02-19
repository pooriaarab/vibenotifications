import { createInterface } from "readline";
import { loadSettings, saveSettings, ensureDir } from "../core/config.js";
import { loadPlugins } from "../core/plugins.js";
import { installHooks } from "../core/hooks.js";

export async function init() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log("");
  console.log("vibenotifications -- customizable notifications for Claude Code");
  console.log("");

  ensureDir();
  const plugins = await loadPlugins();
  const settings = loadSettings();

  console.log("Available sources:");
  const pluginList = Object.values(plugins);
  for (let i = 0; i < pluginList.length; i++) {
    const p = pluginList[i];
    const status = settings.sources[p.name]?.enabled ? " (enabled)" : "";
    console.log(`  ${i + 1}. ${p.displayName}${status}`);
  }

  console.log("");
  const selection = await ask("Which sources to enable? (comma-separated numbers, e.g. 1,2,5): ");
  const indices = selection.split(",").map((s) => parseInt(s.trim()) - 1).filter((i) => i >= 0 && i < pluginList.length);

  for (const idx of indices) {
    const plugin = pluginList[idx];
    console.log("");
    console.log(`Setting up ${plugin.displayName}...`);

    const pluginConfig = { enabled: true };
    for (const [key, schema] of Object.entries(plugin.requiredConfig)) {
      if (schema.instructions) {
        console.log(`  ${schema.instructions}`);
      }
      const value = await ask(`  ${schema.label}: `);
      pluginConfig[key] = value.trim();
    }

    // Test connection
    try {
      const result = await plugin.setup(pluginConfig);
      console.log(`  Connected! ${JSON.stringify(result)}`);
      settings.sources[plugin.name] = pluginConfig;
    } catch (err) {
      console.log(`  Connection failed: ${err.message}`);
      const retry = await ask("  Skip this source? (y/n): ");
      if (retry.toLowerCase() !== "n") continue;
    }
  }

  saveSettings(settings);
  console.log("");
  console.log("  Saved settings to ~/.vibenotifications/settings.json");

  // Install Claude Code hooks
  await installHooks();
  console.log("  Installed Claude Code hooks");

  console.log("");
  console.log("Done! Run 'vibenotifications fetch' to test, or 'vibenotifications start' for the daemon.");
  console.log("Run 'vibenotifications dashboard' to see notifications.");
  console.log("");

  rl.close();
}
