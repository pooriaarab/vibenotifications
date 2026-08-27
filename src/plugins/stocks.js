export default {
  name: "stocks",
  displayName: "Stocks/Crypto",
  icon: "$",

  requiredConfig: {
    symbols: {
      label: "Symbols to track",
      type: "string",
      placeholder: "BTC,ETH,SOL",
      instructions: "Enter crypto or stock symbols separated by commas.\n   Crypto (free): BTC, ETH, SOL, DOGE  |  Stocks: AAPL, TSLA, etc.",
      validate: (value) => {
        if (!value) return "Enter at least one symbol.";
        const symbols = value.split(",").map((s) => s.trim()).filter(Boolean);
        if (symbols.length === 0) return "Enter at least one symbol.";
        for (const s of symbols) {
          if (!/^[A-Za-z]{1,10}$/.test(s)) {
            return `'${s}' doesn't look like a valid ticker symbol (letters only, 1-10 chars).`;
          }
        }
        return null;
      },
    },
  },

  setup: async (config) => {
    const symbols = parseSymbols(config.symbols);
    if (symbols.length === 0) throw new Error("No symbols provided");
    return { connected: true, tracking: symbols.length + " symbols" };
  },

  fetch: async (config) => {
    const symbols = parseSymbols(config.symbols);
    const notifications = [];
    const cryptoMap = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin" };
    const cryptoSymbols = symbols.filter((s) => cryptoMap[s.toUpperCase()]);
    const stockSymbols = symbols.filter((s) => !cryptoMap[s.toUpperCase()]);
    await fetchCryptoNotifications(cryptoSymbols, cryptoMap, notifications);
    addStockPlaceholders(stockSymbols, notifications);
    return notifications;
  },
};

function parseSymbols(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") return input.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

async function fetchCryptoNotifications(cryptoSymbols, cryptoMap, notifications) {
  if (cryptoSymbols.length === 0) return;
  try {
    const ids = cryptoSymbols.map((s) => cryptoMap[s.toUpperCase()]).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return;
    const data = await res.json();
    for (const symbol of cryptoSymbols) {
      processCryptoSymbol(symbol, cryptoMap, data, notifications);
    }
  } catch {
    // Silent fail for crypto
  }
}

function processCryptoSymbol(symbol, cryptoMap, data, notifications) {
  const id = cryptoMap[symbol.toUpperCase()];
  const info = data[id];
  if (!info) return;
  notifications.push(buildCryptoNotification(symbol, id, info));
}

function buildCryptoNotification(symbol, id, info) {
  const change = info.usd_24h_change?.toFixed(1) || "0.0";
  const arrow = parseFloat(change) >= 0 ? "+" : "";
  return {
    id: `stocks-${symbol}-${Math.floor(Date.now() / (5 * 60000))}`,
    source: "stocks",
    title: `${symbol.toUpperCase()}: $${info.usd.toLocaleString()} (${arrow}${change}%)`,
    body: `24h change: ${arrow}${change}%`,
    url: `https://www.coingecko.com/en/coins/${id}`,
    priority: Math.abs(parseFloat(change)) > 5 ? "high" : "low",
    timestamp: new Date().toISOString(),
    actionable: false,
  };
}

function addStockPlaceholders(stockSymbols, notifications) {
  for (const symbol of stockSymbols) {
    notifications.push(buildStockPlaceholder(symbol));
  }
}

function buildStockPlaceholder(symbol) {
  return {
    id: `stocks-${symbol}-${Math.floor(Date.now() / (5 * 60000))}`,
    source: "stocks",
    title: `${symbol.toUpperCase()}: price tracking requires API key (coming soon)`,
    body: "Stock price tracking via Alpha Vantage coming in next release",
    url: `https://finance.yahoo.com/quote/${symbol}`,
    priority: "low",
    timestamp: new Date().toISOString(),
    actionable: false,
  };
}
