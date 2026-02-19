import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, "../plugins");

let pluginCache = null;

export async function loadPlugins() {
  if (pluginCache) return pluginCache;

  const files = readdirSync(PLUGINS_DIR).filter((f) => f.endsWith(".js"));
  const plugins = {};

  for (const file of files) {
    const mod = await import(join(PLUGINS_DIR, file));
    const plugin = mod.default;
    plugins[plugin.name] = plugin;
  }

  pluginCache = plugins;
  return plugins;
}

export async function getPlugin(name) {
  const plugins = await loadPlugins();
  return plugins[name] || null;
}

export async function getEnabledPlugins(settings) {
  const plugins = await loadPlugins();
  const enabled = [];
  for (const [name, config] of Object.entries(settings.sources)) {
    if (config.enabled && plugins[name]) {
      enabled.push({ plugin: plugins[name], config });
    }
  }
  return enabled;
}
