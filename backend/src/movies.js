const { ApiError, validationError, notFound } = require('./errors');
const { wouldCreateCycle } = require('./graph');

const MIN_YEAR = 1888; // first film ever made, a sane lower bound
const MAX_YEAR = 2100;

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
const norm = (s) => s.trim().toLowerCase();

const circular = (message) => new ApiError(409, 'CIRCULAR_DEPENDENCY', message);

function findById(state, id) {
  return state.movies.find((m) => m.id === id);
}

function findByTitle(state, title) {
  const key = norm(title);
  return state.movies.find((m) => norm(m.title) === key);
}

/**
 * Turns the raw `prerequisites` value into a list of unique movie ids.
 * Each entry may be a movie id (number) or an exact movie title (string).
 * Titles make it possible to create a whole batch of movies in one request.
 */
function resolvePrerequisites(state, raw, details, selfTitle) {
  if (!Array.isArray(raw)) {
    details.push({ field: 'prerequisites', message: 'must be an array of movie ids or titles' });
    return null;
  }
  const ids = [];
  for (const entry of raw) {
    let movie;
    if (isInt(entry)) {
      movie = findById(state, entry);
    } else if (typeof entry === 'string' && entry.trim() !== '') {
      if (selfTitle && norm(entry) === norm(selfTitle)) {
        throw circular('A movie cannot be a prerequisite of itself.');
      }
      movie = findByTitle(state, entry);
    } else {
      details.push({ field: 'prerequisites', message: `invalid entry ${JSON.stringify(entry)}` });
      continue;
    }
    if (!movie) {
      details.push({ field: 'prerequisites', message: `unknown movie ${JSON.stringify(entry)}` });
      continue;
    }
    if (!ids.includes(movie.id)) ids.push(movie.id);
  }
  return ids;
}

function checkTitle(value, details) {
  if (typeof value !== 'string' || value.trim() === '') {
    details.push({ field: 'title', message: 'is required and must be a non empty string' });
  } else if (value.trim().length > 200) {
    details.push({ field: 'title', message: 'must be at most 200 characters' });
  }
}

function checkYear(value, details) {
  if (!isInt(value) || value < MIN_YEAR || value > MAX_YEAR) {
    details.push({ field: 'releaseYear', message: `must be an integer between ${MIN_YEAR} and ${MAX_YEAR}` });
  }
}

function checkRuntime(value, details) {
  if (!isInt(value) || value < 1 || value > 300) {
    details.push({ field: 'runtimeMinutes', message: 'must be an integer between 1 and 300' });
  }
}

function checkWatched(value, details) {
  if (typeof value !== 'boolean') {
    details.push({ field: 'watched', message: 'must be true or false' });
  }
}

// Optional poster image: null, or a path like /posters/x.jpg, or an http(s) link.
function checkPoster(value, details) {
  if (value === null) return;
  if (typeof value !== 'string' || value.length > 500 || !/^(\/|https?:\/\/)\S+$/.test(value)) {
    details.push({ field: 'posterUrl', message: 'must be null, a path starting with /, or an http(s) link' });
  }
}

function assertObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError([{ field: 'body', message: 'must be a JSON object' }]);
  }
}

/** Creates one movie inside `state` (mutates it). */
function createMovie(state, body) {
  assertObject(body);
  const details = [];

  checkTitle(body.title, details);
  checkYear(body.releaseYear, details);
  checkRuntime(body.runtimeMinutes, details);
  if (body.watched !== undefined) checkWatched(body.watched, details);
  if (body.posterUrl !== undefined) checkPoster(body.posterUrl, details);

  let prereqs = [];
  if (body.prerequisites !== undefined) {
    const title = typeof body.title === 'string' ? body.title : undefined;
    const resolved = resolvePrerequisites(state, body.prerequisites, details, title);
    if (resolved) prereqs = resolved;
  }

  if (details.length > 0) throw validationError(details);

  if (findByTitle(state, body.title)) {
    throw new ApiError(409, 'DUPLICATE_TITLE', `A movie titled "${body.title.trim()}" already exists.`);
  }

  // A brand new movie has no dependents yet, so it cannot be part of a cycle.
  const movie = {
    id: state.nextMovieId++,
    title: body.title.trim(),
    releaseYear: body.releaseYear,
    runtimeMinutes: body.runtimeMinutes,
    prerequisites: prereqs,
    watched: body.watched === undefined ? false : body.watched,
    posterUrl: body.posterUrl === undefined ? null : body.posterUrl,
  };
  state.movies.push(movie);
  return movie;
}

/** Applies a partial update to one movie inside `state` (mutates it). */
function updateMovie(state, id, body) {
  assertObject(body);
  const movie = findById(state, id);
  if (!movie) throw notFound('Movie');

  const details = [];
  if (body.title !== undefined) checkTitle(body.title, details);
  if (body.releaseYear !== undefined) checkYear(body.releaseYear, details);
  if (body.runtimeMinutes !== undefined) checkRuntime(body.runtimeMinutes, details);
  if (body.watched !== undefined) checkWatched(body.watched, details);
  if (body.posterUrl !== undefined) checkPoster(body.posterUrl, details);

  let prereqs;
  if (body.prerequisites !== undefined) {
    prereqs = resolvePrerequisites(state, body.prerequisites, details);
  }

  if (details.length > 0) throw validationError(details);

  if (body.title !== undefined) {
    const clash = findByTitle(state, body.title);
    if (clash && clash.id !== id) {
      throw new ApiError(409, 'DUPLICATE_TITLE', `A movie titled "${body.title.trim()}" already exists.`);
    }
  }

  if (prereqs !== undefined) {
    if (prereqs.includes(id)) {
      throw circular('A movie cannot be a prerequisite of itself.');
    }
    const getPrereqs = (movieId) => findById(state, movieId).prerequisites;
    if (wouldCreateCycle(id, prereqs, getPrereqs)) {
      throw circular('These prerequisites would create a circular dependency.');
    }
    movie.prerequisites = prereqs;
  }

  if (body.title !== undefined) movie.title = body.title.trim();
  if (body.releaseYear !== undefined) movie.releaseYear = body.releaseYear;
  if (body.runtimeMinutes !== undefined) movie.runtimeMinutes = body.runtimeMinutes;
  if (body.watched !== undefined) movie.watched = body.watched;
  if (body.posterUrl !== undefined) movie.posterUrl = body.posterUrl;
  return movie;
}

module.exports = { createMovie, updateMovie, findById };
