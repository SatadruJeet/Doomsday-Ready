const { createMovie } = require('./movies');
const { createCinema } = require('./cinemas');

/** The sample data from the assessment, plus the example cinemas. */
const SAMPLE_MOVIES = [
  { title: 'Iron Man', releaseYear: 2008, runtimeMinutes: 126, prerequisites: [] },
  { title: 'Captain America: The First Avenger', releaseYear: 2011, runtimeMinutes: 124, prerequisites: [] },
  {
    title: 'The Avengers',
    releaseYear: 2012,
    runtimeMinutes: 143,
    prerequisites: ['Iron Man', 'Captain America: The First Avenger'],
  },
  { title: 'Captain America: Civil War', releaseYear: 2016, runtimeMinutes: 147, prerequisites: ['The Avengers'] },
  { title: 'Thor: Ragnarok', releaseYear: 2017, runtimeMinutes: 130, prerequisites: [] },
  {
    title: 'Avengers: Infinity War',
    releaseYear: 2018,
    runtimeMinutes: 149,
    prerequisites: ['Captain America: Civil War', 'Thor: Ragnarok'],
  },
  { title: 'Avengers: Endgame', releaseYear: 2019, runtimeMinutes: 181, prerequisites: ['Avengers: Infinity War'] },
  { title: 'Avengers: Doomsday', releaseYear: 2026, runtimeMinutes: 150, prerequisites: ['Avengers: Endgame'] },
];

/** Poster images shipped with the frontend (frontend/public/posters). */
const POSTERS = {
  'Iron Man': '/posters/iron-man.jpg',
  'Captain America: The First Avenger': '/posters/captain-america-the-first-avenger.jpg',
  'The Avengers': '/posters/the-avengers.jpg',
  'Captain America: Civil War': '/posters/captain-america-civil-war.jpg',
  'Thor: Ragnarok': '/posters/thor-ragnarok.jpg',
  'Avengers: Infinity War': '/posters/avengers-infinity-war.jpg',
  'Avengers: Endgame': '/posters/avengers-endgame.jpg',
  'Avengers: Doomsday': '/posters/avengers-doomsday.jpg',
};

const SAMPLE_CINEMAS = [
  { name: 'Star Cineplex (sizes 1, 3, 4)', bundleSizes: [1, 3, 4] },
  { name: 'Grand Premiere (sizes 2, 5)', bundleSizes: [2, 5] },
  { name: 'Megaplex (sizes 6, 9, 20)', bundleSizes: [6, 9, 20] },
  { name: 'Odd Seats Cinema (sizes 4, 6)', bundleSizes: [4, 6] },
];

/**
 * Gives the sample movies their posters. Only fills in movies that have no
 * poster yet, so it is safe to run on data created before posters existed and
 * never overwrites a poster the user chose.
 */
function applyPosters(state) {
  for (const movie of state.movies) {
    if (!movie.posterUrl && POSTERS[movie.title]) movie.posterUrl = POSTERS[movie.title];
  }
}

function seedState(state) {
  SAMPLE_MOVIES.forEach((m) => createMovie(state, m));
  SAMPLE_CINEMAS.forEach((c) => createCinema(state, c));
  applyPosters(state);
}

if (require.main === module) {
  const path = require('path');
  const { Store } = require('./store');
  const file = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
  const store = new Store(file);
  if (store.isEmpty()) {
    store.mutate(seedState);
    console.log(`Seeded sample data into ${file}`);
  } else {
    store.mutate(applyPosters);
    console.log('Store already has data. Added posters to any sample movies that lacked one.');
  }
}

module.exports = { seedState, applyPosters };
