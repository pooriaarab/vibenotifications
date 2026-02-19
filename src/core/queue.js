const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

export function deduplicateNotifications(existing, incoming) {
  const seen = new Set(existing.map((n) => n.id));
  const newOnes = incoming.filter((n) => !seen.has(n.id));
  return [...newOnes, ...existing];
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
  return notifications.filter(
    (n) => (PRIORITY_ORDER[n.priority] ?? 2) <= minOrder
  );
}

export function trimNotifications(notifications, maxAge = 24 * 60 * 60 * 1000, maxCount = 100) {
  const cutoff = Date.now() - maxAge;
  return notifications
    .filter((n) => new Date(n.timestamp).getTime() > cutoff)
    .slice(0, maxCount);
}
