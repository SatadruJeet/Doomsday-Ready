const { ApiError, validationError } = require('./errors');

const norm = (s) => s.trim().toLowerCase();
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

function findCinemaById(state, id) {
  return state.cinemas.find((c) => c.id === id);
}

/** Creates one cinema inside `state` (mutates it). */
function createCinema(state, body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError([{ field: 'body', message: 'must be a JSON object' }]);
  }
  const details = [];

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    details.push({ field: 'name', message: 'is required and must be a non empty string' });
  } else if (body.name.trim().length > 200) {
    details.push({ field: 'name', message: 'must be at most 200 characters' });
  }

  const sizes = body.bundleSizes;
  if (!Array.isArray(sizes)) {
    details.push({ field: 'bundleSizes', message: 'must be an array of 1 to 10 different integers' });
  } else {
    if (sizes.length < 1 || sizes.length > 10) {
      details.push({ field: 'bundleSizes', message: 'must contain between 1 and 10 sizes' });
    }
    if (!sizes.every((s) => isInt(s) && s >= 1 && s <= 500)) {
      details.push({ field: 'bundleSizes', message: 'every size must be an integer between 1 and 500' });
    } else if (new Set(sizes).size !== sizes.length) {
      details.push({ field: 'bundleSizes', message: 'sizes must be different from each other' });
    }
  }

  if (details.length > 0) throw validationError(details);

  const duplicate = state.cinemas.find((c) => norm(c.name) === norm(body.name));
  if (duplicate) {
    throw new ApiError(409, 'DUPLICATE_NAME', `A cinema named "${body.name.trim()}" already exists.`);
  }

  const cinema = {
    id: state.nextCinemaId++,
    name: body.name.trim(),
    bundleSizes: [...sizes].sort((a, b) => a - b),
  };
  state.cinemas.push(cinema);
  return cinema;
}

module.exports = { createCinema, findCinemaById };
