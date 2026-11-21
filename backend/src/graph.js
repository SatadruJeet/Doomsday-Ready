/**
 * Feature 1 graph logic, written by hand (no graph libraries).
 *
 * Movies form a directed graph: an edge M -> P means "P is a prerequisite of M".
 * Both functions take a `getPrereqs(id)` callback that returns the prerequisite
 * ids of a movie, so they stay independent of how movies are stored.
 *
 * Both are iterative (explicit stacks) so a very long prerequisite chain cannot
 * overflow the call stack.
 */

/**
 * Would giving `movieId` the prerequisites `newPrereqIds` create a cycle?
 *
 * A cycle appears exactly when `movieId` is already reachable by following
 * prerequisite links from one of the new prerequisites (or is one of them).
 * Example: Endgame is a transitive prerequisite of Doomsday. Making Doomsday a
 * prerequisite of Iron Man is a cycle only if Iron Man is reachable from
 * Doomsday, which it is. The same check handles self dependency.
 */
function wouldCreateCycle(movieId, newPrereqIds, getPrereqs) {
  const seen = new Set();
  const stack = [...newPrereqIds];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === movieId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const p of getPrereqs(current)) stack.push(p);
  }
  return false;
}

/**
 * Every movie that must be seen before `targetId`, each exactly once, ordered so
 * that a movie always comes after all of its own prerequisites. The target is
 * not included.
 *
 * This is an iterative depth first search that emits a node after all of its
 * prerequisites have been emitted (post order), which is a valid topological
 * order. Prerequisites are visited in the order they were stored, so the result
 * is deterministic.
 *
 * Assumes the graph is acyclic, which the validation in `wouldCreateCycle`
 * guarantees for stored data.
 */
function rewatchOrder(targetId, getPrereqs) {
  const visited = new Set([targetId]);
  const order = [];
  const stack = [{ id: targetId, next: 0, prereqs: getPrereqs(targetId) }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.next < frame.prereqs.length) {
      const prereq = frame.prereqs[frame.next++];
      if (!visited.has(prereq)) {
        visited.add(prereq);
        stack.push({ id: prereq, next: 0, prereqs: getPrereqs(prereq) });
      }
    } else {
      stack.pop();
      if (frame.id !== targetId) order.push(frame.id);
    }
  }
  return order;
}

module.exports = { wouldCreateCycle, rewatchOrder };
