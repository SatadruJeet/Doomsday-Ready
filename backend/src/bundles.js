/**
 * Feature 2: fewest bundles that add up to exactly `groupSize`.
 *
 * This is the classic minimum coin change problem, solved with dynamic
 * programming (written by hand, no library). Greedy does not work here:
 * with sizes 1, 3, 4 and a group of 6, greedy picks 4+1+1 (3 bundles) but the
 * best answer is 3+3 (2 bundles).
 *
 * best[n] = fewest bundles summing to exactly n seats (Infinity if impossible)
 * best[0] = 0
 * best[n] = 1 + min(best[n - size]) over every size <= n
 *
 * Complexity is O(groupSize * number of sizes), at most 10,000 * 10 steps.
 *
 * Several optimal answers can exist, so ties are broken deterministically in
 * favour of larger bundles: sizes are tried largest first and an option only
 * replaces the current one when it is strictly better.
 *
 * Returns { possible, totalBundles, bundles: [{ size, count }] } with bundles
 * sorted from the largest size to the smallest.
 */
function bookingQuote(bundleSizes, groupSize) {
  const sizes = [...bundleSizes].sort((a, b) => b - a);
  const best = new Array(groupSize + 1).fill(Infinity);
  const choice = new Array(groupSize + 1).fill(0);
  best[0] = 0;

  for (let n = 1; n <= groupSize; n++) {
    for (const size of sizes) {
      if (size > n) continue;
      const candidate = best[n - size] + 1;
      if (candidate < best[n]) {
        best[n] = candidate;
        choice[n] = size;
      }
    }
  }

  if (best[groupSize] === Infinity) {
    return { possible: false, totalBundles: null, bundles: [] };
  }

  const counts = new Map();
  let remaining = groupSize;
  while (remaining > 0) {
    const size = choice[remaining];
    counts.set(size, (counts.get(size) || 0) + 1);
    remaining -= size;
  }

  const bundles = [...counts.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.size - a.size);

  return { possible: true, totalBundles: best[groupSize], bundles };
}

module.exports = { bookingQuote };
