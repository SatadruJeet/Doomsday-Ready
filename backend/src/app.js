const express = require('express');
const cors = require('cors');
const { ApiError, validationError, notFound } = require('./errors');
const { createMovie, updateMovie, findById } = require('./movies');
const { createCinema, findCinemaById } = require('./cinemas');
const { rewatchOrder } = require('./graph');
const { bookingQuote } = require('./bundles');

/** Reads `:id` from the URL. Ids are positive integers. */
function parseId(raw) {
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
}

const asList = (body) => (Array.isArray(body) ? body : [body]);

function createApp(store) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const api = express.Router();

  // ---------- Movies ----------

  // Accepts one movie or an array of movies. An array is all or nothing, and
  // later movies in the array may reference earlier ones by title.
  api.post('/movies', (req, res) => {
    const created = store.mutate((state) => asList(req.body).map((b) => createMovie(state, b)));
    res.status(201).json(Array.isArray(req.body) ? created : created[0]);
  });

  api.get('/movies', (req, res) => {
    res.json(store.state.movies);
  });

  api.get('/movies/:id', (req, res) => {
    const movie = findById(store.state, parseId(req.params.id));
    if (!movie) throw notFound('Movie');
    res.json(movie);
  });

  api.patch('/movies/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw notFound('Movie');
    const updated = store.mutate((state) => updateMovie(state, id, req.body));
    res.json(updated);
  });

  api.get('/movies/:id/rewatch-order', (req, res) => {
    const { state } = store;
    const id = parseId(req.params.id);
    const target = id === null ? undefined : findById(state, id);
    if (!target) throw notFound('Movie');

    const orderedIds = rewatchOrder(id, (movieId) => findById(state, movieId).prerequisites);
    const order = orderedIds.map((movieId) => findById(state, movieId));

    res.json({
      target: { id: target.id, title: target.title },
      order,
      totalCount: order.length,
      watchedCount: order.filter((m) => m.watched).length,
      unwatchedRuntimeMinutes: order
        .filter((m) => !m.watched)
        .reduce((sum, m) => sum + m.runtimeMinutes, 0),
    });
  });

  // ---------- Cinemas ----------

  api.post('/cinemas', (req, res) => {
    const created = store.mutate((state) => asList(req.body).map((b) => createCinema(state, b)));
    res.status(201).json(Array.isArray(req.body) ? created : created[0]);
  });

  api.get('/cinemas', (req, res) => {
    res.json(store.state.cinemas);
  });

  api.get('/cinemas/:id', (req, res) => {
    const cinema = findCinemaById(store.state, parseId(req.params.id));
    if (!cinema) throw notFound('Cinema');
    res.json(cinema);
  });

  api.get('/cinemas/:id/booking', (req, res) => {
    const cinema = findCinemaById(store.state, parseId(req.params.id));
    if (!cinema) throw notFound('Cinema');

    const raw = req.query.groupSize;
    const groupSize = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > 10000) {
      throw validationError([{ field: 'groupSize', message: 'must be an integer between 1 and 10000' }]);
    }

    const quote = bookingQuote(cinema.bundleSizes, groupSize);
    res.json({
      cinemaId: cinema.id,
      cinemaName: cinema.name,
      groupSize,
      ...quote,
      message: quote.possible
        ? undefined
        : `Not possible: no combination of ${cinema.bundleSizes.join(', ')} adds up to exactly ${groupSize}.`,
    });
  });

  app.use('/api', api);

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // ---------- Errors ----------

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      const error = { code: err.code, message: err.message };
      if (err.details) error.details = err.details;
      return res.status(err.status).json({ error });
    }
    if (err.type === 'entity.parse.failed') {
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON.' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
  });

  return app;
}

module.exports = { createApp };
