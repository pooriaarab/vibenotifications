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

function buildHeader(title) {
  return `${ANSI.clearLine}${ANSI.bold}${title}${ANSI.reset}\n`
    + `${ANSI.clearLine}${ANSI.gray}  ↑/↓ navigate  ·  enter select  ·  a select all${ANSI.reset}\n`
    + `${ANSI.clearLine}\n`;
}

function formatItemLine(item, isCursor, isSelected) {
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
  return `${ANSI.clearLine}  ${pointer} ${checkbox} ${label}${desc}\n`;
}

function buildItemsOutput(items, cursor, selected) {
  let out = "";
  for (let i = 0; i < items.length; i++) {
    out += formatItemLine(items[i], i === cursor, selected.has(items[i].name));
  }
  return out;
}

function buildDoneOutput(cursor, doneIndex, selected) {
  const isDone = cursor === doneIndex;
  const count = selected.size;
  const doneLabel = count > 0 ? `Done (${count} selected)` : "Done";
  if (isDone) {
    return `${ANSI.clearLine}  ${ANSI.cyan}❯${ANSI.reset} ${ANSI.green}${ANSI.bold}→ ${doneLabel}${ANSI.reset}\n`;
  }
  return `${ANSI.clearLine}    ${ANSI.gray}→ ${doneLabel}${ANSI.reset}\n`;
}

function buildCheckboxOutput(title, items, state) {
  return buildHeader(title)
    + buildItemsOutput(items, state.cursor, state.selected)
    + buildDoneOutput(state.cursor, state.doneIndex, state.selected)
    + `${ANSI.clearLine}`;
}

function handleUp(state, render) {
  state.cursor = state.cursor > 0 ? state.cursor - 1 : state.doneIndex;
  render();
}

function handleDown(state, render) {
  state.cursor = state.cursor < state.doneIndex ? state.cursor + 1 : 0;
  render();
}

function handleSpaceOrEnter(state, ctx) {
  if (state.cursor === state.doneIndex) {
    handleConfirm(state, ctx.items, ctx.cleanup, ctx.resolve);
    return;
  }
  const name = ctx.items[state.cursor].name;
  if (state.selected.has(name)) state.selected.delete(name);
  else state.selected.add(name);
  ctx.render();
}

function handleConfirm(state, items, cleanup, resolve) {
  cleanup();
  const selectedLabels = items.filter((i) => state.selected.has(i.name)).map((i) => i.label);
  if (selectedLabels.length > 0) {
    console.log(`${ANSI.green}Selected:${ANSI.reset} ${selectedLabels.join(", ")}\n`);
  } else {
    console.log(`${ANSI.gray}No sources selected.${ANSI.reset}\n`);
  }
  resolve(items.filter((i) => state.selected.has(i.name)).map((i) => i.name));
}

function handleSelectAll(state, items, render) {
  if (state.selected.size === items.length) state.selected.clear();
  else for (const item of items) state.selected.add(item.name);
  render();
}

function createInitialState(items, doneIndex) {
  return { cursor: 0, selected: new Set(items.filter((i) => i.checked).map((i) => i.name)), doneIndex };
}

/**
 * Multi-select checkbox prompt with arrow key navigation.
 *
 * @param {string} title - Prompt title
 * @param {Array<{name: string, label: string, description?: string, checked?: boolean}>} items
 * @returns {Promise<string[]>} - Array of selected item names
 */
export function checkboxSelect(title, items) {
  const doneIndex = items.length;
  return new Promise((resolve) => {
    const state = createInitialState(items, doneIndex);

    function render() {
      const totalLines = doneIndex + 5;
      let output = `\x1b[${totalLines}A`;
      output += buildCheckboxOutput(title, items, state);
      process.stdout.write(output);
    }

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.removeListener("data", onKey);
      process.stdin.pause();
      process.stdout.write(ANSI.cursorShow);
    }

    function onKey(key) {
      if (key === "\x03") {
        cleanup();
        process.exit(0);
      }
      if (key === "\x1b[A" || key === "k") {
        handleUp(state, render);
        return;
      }
      if (key === "\x1b[B" || key === "j") {
        handleDown(state, render);
        return;
      }
      if (key === "\r" || key === "\n" || key === " ") {
        handleSpaceOrEnter(state, { items, cleanup, resolve, render });
        return;
      }
      if (key === "a") {
        handleSelectAll(state, items, render);
      }
    }

    const totalLines = doneIndex + 5;
    process.stdout.write("\n".repeat(totalLines));
    render();
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
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

    // Mask typed characters as "*" for secret fields (tokens, passwords) so
    // they don't land in terminal scrollback / tmux history / screen recordings.
    if (options.mask) {
      const realWrite = rl.output.write.bind(rl.output);
      rl._writeToOutput = (str) => {
        if (str.startsWith(`  ${label}`) || /[\r\n]/.test(str)) {
          realWrite(str);
        } else {
          realWrite(str.replace(/[^\r\n]/g, "*"));
        }
      };
    }

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
