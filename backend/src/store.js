const fs = require('fs');
const path = require('path');

/**
 * A tiny store: all data lives in memory and is saved to one JSON file after
 * every successful change, so data survives restarts without a database.
 *
 * `mutate` runs a change against a copy of the state and only keeps it when the
 * change finishes without throwing. That makes batch requests all or nothing.
 */
class Store {
  constructor(filePath) {
    this.filePath = filePath || null;
    this.state = { movies: [], cinemas: [], nextMovieId: 1, nextCinemaId: 1 };
    if (this.filePath && fs.existsSync(this.filePath)) {
      this.state = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    }
  }

  mutate(fn) {
    const draft = structuredClone(this.state);
    const result = fn(draft);
    this.state = draft;
    this.persist();
    return result;
  }

  persist() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  isEmpty() {
    return this.state.movies.length === 0 && this.state.cinemas.length === 0;
  }
}

module.exports = { Store };
