import { loadSettings, saveSettings, ensureDir } from "../core/config.js";
import { loadPlugins } from "../core/plugins.js";
import { installHooks } from "../core/hooks.js";
import { checkboxSelect, textInput, ANSI } from "./prompts.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

function buildItems(plugins, settings, connectedMCPs) {
  return Object.values(plugins).map((p) => {
    const alreadyEnabled = settings.sources[p.name]?.enabled;
    const noKey = Object.keys(p.requiredConfig).length === 0;
    let desc = "";
    if (alreadyEnabled) desc = "already enabled";
    else if (p.name === "mcp-bridge" && connectedMCPs.length > 0) desc = `${connectedMCPs.length} connected: ${connectedMCPs.join(", ")}`;
    else if (noKey) desc = "no API key needed";
    return { name: p.name, label: p.displayName, description: desc, checked: !!alreadyEnabled };
  });
}

async function configurePlugin(name, plugin, settings) {
  if (settings.sources[name]?.enabled) {
    console.log(`${ANSI.gray}  ${plugin.displayName} already configured, skipping.${ANSI.reset}`);
    return;
  }
  console.log(`${ANSI.bold}Setting up ${plugin.displayName}...${ANSI.reset}`);
  const pluginConfig = { enabled: true };
  for (const [key, schema] of Object.entries(plugin.requiredConfig)) {
    if (schema.instructions) console.log(`${ANSI.gray}  ${schema.instructions}${ANSI.reset}`);
    const value = await textInput(schema.label, {
      placeholder: schema.placeholder,
      validate: schema.validate,
      mask: schema.type === "secret",
    });
    pluginConfig[key] = value;
  }
  try {
    const result = await plugin.setup(pluginConfig);
    console.log(`  ${ANSI.green}✓ Connected!${ANSI.reset} ${ANSI.gray}${formatResult(result)}${ANSI.reset}`);
    settings.sources[plugin.name] = pluginConfig;
  } catch (err) {
    console.log(`  ${ANSI.red}✗ Connection failed: ${err.message}${ANSI.reset}`);
    console.log(`  ${ANSI.gray}Skipping ${plugin.displayName}. You can try again with 'vibenotifications add ${name}'.${ANSI.reset}`);
  }
  console.log("");
}

async function configureSelectedPlugins(selectedNames, plugins, settings) {
  for (const name of selectedNames) {
    const plugin = plugins[name];
    if (!plugin) continue;
    await configurePlugin(name, plugin, settings);
  }
}

export async function init() {
  console.log("");
  console.log(`${ANSI.bold}vibenotifications${ANSI.reset} ${ANSI.gray}— customizable notifications for Claude Code${ANSI.reset}`);
  console.log("");
  ensureDir();
  const plugins = await loadPlugins();
  const settings = loadSettings();
  const connectedMCPs = getConnectedMCPs();
  const items = buildItems(plugins, settings, connectedMCPs);
  const selectedNames = await checkboxSelect("Which sources do you want to enable?", items);
  if (selectedNames.length === 0) {
    console.log("No sources selected. You can add them later with 'vibenotifications add <plugin>'.");
    return;
  }
  await configureSelectedPlugins(selectedNames, plugins, settings);
  saveSettings(settings);
  console.log(`  ${ANSI.green}✓${ANSI.reset} Saved settings to ~/.vibenotifications/settings.json`);
  await installHooks();
  console.log(`  ${ANSI.green}✓${ANSI.reset} Installed Claude Code hooks`);
  console.log("");
  console.log(`${ANSI.bold}You're all set!${ANSI.reset}`);
  console.log(`  Run ${ANSI.cyan}vibenotifications fetch${ANSI.reset} to test`);
  console.log(`  Run ${ANSI.cyan}vibenotifications start${ANSI.reset} to start the background daemon`);
  console.log(`  Run ${ANSI.cyan}vibenotifications dashboard${ANSI.reset} to see notifications`);
  console.log("");
}

function getConnectedMCPs() {
  const paths = [
    join(homedir(), ".claude", "settings.json"),
    join(homedir(), ".claude", "settings.local.json"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, "utf-8"));
        if (data.mcpServers && Object.keys(data.mcpServers).length > 0) {
          return Object.keys(data.mcpServers);
        }
      } catch {
        // ignore
      }
    }
  }
  return [];
}

function formatResult(result) {
  const parts = [];
  for (const [k, v] of Object.entries(result)) {
    if (k === "connected") continue;
    parts.push(`${k}: ${v}`);
  }
  return parts.join(", ");
}
