const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

const BUCKET_REPLACE_SOURCES = new Set(["carbon", "email", "mcp-bridge", "stocks"]);

// Strip a trailing time-bucket suffix (e.g. "-12345") only for notification
// sources that intentionally use the final numeric segment as a fetch bucket.
// Do not apply this to stable external ids like github-123; those digits are
// the notification identity, not a replaceable time bucket.
function replaceKey(notification) {
  if (!BUCKET_REPLACE_SOURCES.has(notification.source)) return null;
  const match = notification.id.match(/^(.*)-\d+$/);
  return match ? `${notification.source}::${match[1]}` : null;
}

export function deduplicateNotifications(existing, incoming) {
  const incomingById = new Map(incoming.map((n) => [n.id, n]));
  const incomingNotifications = [...incomingById.values()];

  const supersededKeys = new Set(incomingNotifications.map(replaceKey).filter(Boolean));
  const survivors = existing.filter(
    (n) => !incomingById.has(n.id) && !supersededKeys.has(replaceKey(n)),
  );

  return [...incomingNotifications, ...survivors];
}

export function sortByPriority(notifications) {
  return [...notifications].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
}

export function filterByMinPriority(notifications, minPriority) {
  const minOrder = PRIORITY_ORDER[minPriority] ?? 2;
  return notifications.filter((n) => (PRIORITY_ORDER[n.priority] ?? 2) <= minOrder);
}

export function trimNotifications(notifications, maxAge = 24 * 60 * 60 * 1000, maxCount = 100) {
  const cutoff = Date.now() - maxAge;
  return notifications.filter((n) => new Date(n.timestamp).getTime() > cutoff).slice(0, maxCount);
}
