const path = require('path');
const { createApp } = require('./app');
const { Store } = require('./store');
const { seedState, applyPosters } = require('./seed');

const PORT = Number(process.env.PORT) || 3001;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');

const store = new Store(DATA_FILE);

// Optional convenience: start with the assessment's sample data when empty.
if (process.env.SEED_ON_EMPTY === 'true') {
  if (store.isEmpty()) {
    store.mutate(seedState);
    console.log('Seeded sample movies and cinemas.');
  } else {
    store.mutate(applyPosters); // adds posters to older saved sample data
  }
}

createApp(store).listen(PORT, () => {
  console.log(`Doomsday Ready API listening on http://localhost:${PORT}/api`);
});
