export default {
  name: "stocks",
  displayName: "Stocks/Crypto",
  icon: "$",

  requiredConfig: {
    symbols: {
      label: "Symbols to track (comma-separated, e.g. AAPL,BTC,ETH)",
      type: "string",
      instructions: "Enter stock tickers or crypto symbols separated by commas.",
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

    // Crypto via CoinGecko (free, no key)
    const cryptoMap = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin" };
    const cryptoSymbols = symbols.filter((s) => cryptoMap[s.toUpperCase()]);
    const stockSymbols = symbols.filter((s) => !cryptoMap[s.toUpperCase()]);

    if (cryptoSymbols.length > 0) {
      try {
        const ids = cryptoSymbols.map((s) => cryptoMap[s.toUpperCase()]).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        if (res.ok) {
          const data = await res.json();
          for (const symbol of cryptoSymbols) {
            const id = cryptoMap[symbol.toUpperCase()];
            const info = data[id];
            if (info) {
              const change = info.usd_24h_change?.toFixed(1) || "0.0";
              const arrow = parseFloat(change) >= 0 ? "+" : "";
              notifications.push({
                id: `stocks-${symbol}-${Date.now()}`,
                source: "stocks",
                title: `${symbol.toUpperCase()}: $${info.usd.toLocaleString()} (${arrow}${change}%)`,
                body: `24h change: ${arrow}${change}%`,
                url: `https://www.coingecko.com/en/coins/${id}`,
                priority: Math.abs(parseFloat(change)) > 5 ? "high" : "low",
                timestamp: new Date().toISOString(),
                actionable: false,
              });
            }
          }
        }
      } catch {
        // Silent fail for crypto
      }
    }

    // For stocks, we'd use Alpha Vantage or similar — for MVP, just show placeholder
    for (const symbol of stockSymbols) {
      notifications.push({
        id: `stocks-${symbol}-${Date.now()}`,
        source: "stocks",
        title: `${symbol.toUpperCase()}: price tracking requires API key (coming soon)`,
        body: "Stock price tracking via Alpha Vantage coming in next release",
        url: `https://finance.yahoo.com/quote/${symbol}`,
        priority: "low",
        timestamp: new Date().toISOString(),
        actionable: false,
      });
    }

    return notifications;
  },
};

function parseSymbols(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === "string") return input.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
