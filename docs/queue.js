// docs/queue.js
// Pure queue logic (browser + tests)

export function normalizeQueue(queue) {
  const out = [];
  for (const x of (queue || [])) {
    const n = Number(x);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function nextPickFromQueue(queue, opts) {
  const {
    draftedDex = new Set(),
    poolByDex = new Map(),
    remainingBudget = Infinity,
    skipInvalid = true,
  } = opts || {};

  let q = normalizeQueue(queue);

  // de-dupe while preserving order
  const seen = new Set();
  q = q.filter(d => (seen.has(d) ? false : (seen.add(d), true)));

  const removed = [];

  while (q.length) {
    const dex = q[0];
    const mon = poolByDex.get(Number(dex)) || null;

    const unavailable = draftedDex.has(Number(dex)) || !mon;
    if (unavailable) {
      if (!skipInvalid) {
        return { action: 'none', reason: 'unavailable', pickDex: null, queueAfter: q, removed };
      }
      removed.push(dex);
      q = q.slice(1);
      continue;
    }

    const cost = Number(mon.points);
    const overBudget = Number.isFinite(cost) && cost > Number(remainingBudget);
    if (overBudget) {
      if (!skipInvalid) {
        return { action: 'none', reason: 'over_budget', pickDex: null, queueAfter: q, removed };
      }
      removed.push(dex);
      q = q.slice(1);
      continue;
    }

    // valid pick
    return { action: 'pick', reason: 'ok', pickDex: Number(dex), queueAfter: q.slice(1), removed };
  }

  return { action: 'none', reason: 'empty', pickDex: null, queueAfter: [], removed };
}
