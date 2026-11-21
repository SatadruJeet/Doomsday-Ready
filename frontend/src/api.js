// Small fetch wrapper. Failed requests throw an Error with the API's message and code.
async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status})`);
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    throw err;
  }
  return data;
}

export const api = {
  listMovies: () => request('GET', '/movies'),
  createMovie: (movie) => request('POST', '/movies', movie),
  updateMovie: (id, patch) => request('PATCH', `/movies/${id}`, patch),
  rewatchOrder: (id) => request('GET', `/movies/${id}/rewatch-order`),
  listCinemas: () => request('GET', '/cinemas'),
  createCinema: (cinema) => request('POST', '/cinemas', cinema),
  booking: (id, groupSize) => request('GET', `/cinemas/${id}/booking?groupSize=${groupSize}`),
};

// Turns an error into text for the screen, including field level details.
export function describeError(err) {
  const extra = err.details?.map((d) => `${d.field}: ${d.message}`).join('; ');
  const label = err.code === 'CIRCULAR_DEPENDENCY' ? 'Circular dependency. ' : '';
  return `${label}${err.message}${extra ? ` (${extra})` : ''}`;
}

export function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
