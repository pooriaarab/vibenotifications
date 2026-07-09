const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

export function deduplicateNotifications(existing, incoming) {
  // Upsert by id: incoming notifications refresh the content of a matching
  // existing id (e.g. carbon's live session total) instead of piling up as
  // separate entries next to a stale copy.
  const byId = new Map(existing.map((n) => [n.id, n]));
  const newOnes = [];
  for (const n of incoming) {
    if (byId.has(n.id)) byId.set(n.id, n);
    else newOnes.push(n);
  }
  return [...newOnes, ...byId.values()];
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
