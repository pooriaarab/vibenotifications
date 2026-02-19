/**
 * Interactive terminal prompts using raw mode stdin.
 * Zero dependencies — uses Node.js built-in readline and raw TTY.
 */

import { createInterface } from "readline";

const ANSI = {
  clearLine: "\x1b[2K",
  cursorHide: "\x1b[?25l",
  cursorShow: "\x1b[?25h",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
};

export { ANSI };

/**
 * Multi-select checkbox prompt with arrow key navigation.
 *
 * @param {string} title - Prompt title
 * @param {Array<{name: string, label: string, description?: string, checked?: boolean}>} items
 * @returns {Promise<string[]>} - Array of selected item names
 */
export function checkboxSelect(title, items) {
  // Total rows = items + 1 "Done" row
  const DONE_INDEX = items.length;

  return new Promise((resolve) => {
    let cursor = 0;
    const selected = new Set(items.filter((i) => i.checked).map((i) => i.name));

    function render() {
      const totalLines = DONE_INDEX + 5; // title + hint + blank + items + done
      let output = `\x1b[${totalLines}A`;

      output += `${ANSI.clearLine}${ANSI.bold}${title}${ANSI.reset}\n`;
      output += `${ANSI.clearLine}${ANSI.gray}  ↑/↓ navigate  ·  enter select  ·  a select all${ANSI.reset}\n`;
      output += `${ANSI.clearLine}\n`;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isCursor = i === cursor;
        const isSelected = selected.has(item.name);
        const checkbox = isSelected
          ? `${ANSI.green}[✓]${ANSI.reset}`
          : `${ANSI.gray}[ ]${ANSI.reset}`;
        const pointer = isCursor ? `${ANSI.cyan}❯${ANSI.reset}` : " ";
        const label = isCursor
          ? `${ANSI.white}${ANSI.bold}${item.label}${ANSI.reset}`
          : `${item.label}`;
        const desc = item.description
          ? `${ANSI.gray} — ${item.description}${ANSI.reset}`
          : "";

        output += `${ANSI.clearLine}  ${pointer} ${checkbox} ${label}${desc}\n`;
      }

      // "Done" row
      const isDone = cursor === DONE_INDEX;
      const count = selected.size;
      const doneLabel = count > 0
        ? `Done (${count} selected)`
        : "Done";
      if (isDone) {
        output += `${ANSI.clearLine}  ${ANSI.cyan}❯${ANSI.reset} ${ANSI.green}${ANSI.bold}→ ${doneLabel}${ANSI.reset}\n`;
      } else {
        output += `${ANSI.clearLine}    ${ANSI.gray}→ ${doneLabel}${ANSI.reset}\n`;
      }

      output += `${ANSI.clearLine}`;
      process.stdout.write(output);
    }

    const totalLines = DONE_INDEX + 5;
    process.stdout.write("\n".repeat(totalLines));
    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    function onKey(key) {
      if (key === "\x03") { cleanup(); process.exit(0); }

      // Up
      if (key === "\x1b[A" || key === "k") {
        cursor = cursor > 0 ? cursor - 1 : DONE_INDEX;
        render();
        return;
      }

      // Down
      if (key === "\x1b[B" || key === "j") {
        cursor = cursor < DONE_INDEX ? cursor + 1 : 0;
        render();
        return;
      }

      // Enter or Space — toggle if on an item, confirm if on Done
      if (key === "\r" || key === "\n" || key === " ") {
        if (cursor === DONE_INDEX) {
          // Confirm
          cleanup();
          const selectedLabels = items.filter((i) => selected.has(i.name)).map((i) => i.label);
          if (selectedLabels.length > 0) {
            console.log(`${ANSI.green}Selected:${ANSI.reset} ${selectedLabels.join(", ")}\n`);
          } else {
            console.log(`${ANSI.gray}No sources selected.${ANSI.reset}\n`);
          }
          resolve(items.filter((i) => selected.has(i.name)).map((i) => i.name));
          return;
        }

        // Toggle item
        const name = items[cursor].name;
        if (selected.has(name)) selected.delete(name);
        else selected.add(name);
        render();
        return;
      }

      // 'a' — select/deselect all
      if (key === "a") {
        if (selected.size === items.length) selected.clear();
        else for (const item of items) selected.add(item.name);
        render();
        return;
      }
    }

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.removeListener("data", onKey);
      process.stdin.pause();
      process.stdout.write(ANSI.cursorShow);
    }

    process.stdout.write(ANSI.cursorHide);
    process.stdin.on("data", onKey);
  });
}

/**
 * Text input with validation. Re-prompts on invalid input.
 *
 * @param {string} label - Prompt label
 * @param {object} options
 * @param {function} [options.validate] - Returns error string or null if valid
 * @param {string} [options.placeholder] - Hint text
 * @returns {Promise<string>}
 */
export function textInput(label, options = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    function prompt() {
      const hint = options.placeholder ? ` ${ANSI.gray}(${options.placeholder})${ANSI.reset}` : "";
      rl.question(`  ${label}${hint}: `, (answer) => {
        const value = answer.trim();

        if (!value && !options.allowEmpty) {
          console.log(`  ${ANSI.yellow}⚠ This field is required.${ANSI.reset}`);
          prompt();
          return;
        }

        if (options.validate) {
          const error = options.validate(value);
          if (error) {
            console.log(`  ${ANSI.yellow}⚠ ${error}${ANSI.reset}`);
            prompt();
            return;
          }
        }

        rl.close();
        resolve(value);
      });
    }

    prompt();
  });
}

/**
 * Yes/no confirmation prompt.
 *
 * @param {string} message
 * @param {boolean} defaultYes - Default answer
 * @returns {Promise<boolean>}
 */
export function confirm(message, defaultYes = true) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const hint = defaultYes ? "Y/n" : "y/N";
    rl.question(`  ${message} (${hint}): `, (answer) => {
      rl.close();
      const val = answer.trim().toLowerCase();
      if (val === "") resolve(defaultYes);
      else resolve(val === "y" || val === "yes");
    });
  });
}
