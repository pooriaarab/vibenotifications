import { loadSettings, saveSettings } from "../core/config.js";

export async function remove(pluginName) {
  if (!pluginName) {
    console.log("Usage: vibenotifications remove <plugin>");
    return;
  }

  const settings = loadSettings();
  if (settings.sources[pluginName]) {
    delete settings.sources[pluginName];
    saveSettings(settings);
    console.log(`Removed ${pluginName}.`);
  } else {
    console.log(`${pluginName} is not enabled.`);
  }
}
