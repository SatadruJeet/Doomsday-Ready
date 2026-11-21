const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { Store } = require('../src/store');
const { seedState } = require('../src/seed');

let server;
let base;
let ids; // title -> id

async function call(method, path, body) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  const store = new Store(null); // in memory only
  store.mutate(seedState);
  server = createApp(store).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  const movies = (await call('GET', '/movies')).body;
  ids = Object.fromEntries(movies.map((m) => [m.title, m.id]));
});

after(() => server.close());

const titles = (res) => res.body.order.map((m) => m.title);

// ---------- Feature 1 ----------

test('rewatch order for Doomsday lists all 7 other movies in a valid order', async () => {
  const res = await call('GET', `/movies/${ids['Avengers: Doomsday']}/rewatch-order`);
  assert.equal(res.status, 200);
  assert.deepEqual(titles(res), [
    'Iron Man',
    'Captain America: The First Avenger',
    'The Avengers',
    'Captain America: Civil War',
    'Thor: Ragnarok',
    'Avengers: Infinity War',
    'Avengers: Endgame',
  ]);
  assert.equal(res.body.totalCount, 7);
  assert.ok(!titles(res).includes('Avengers: Doomsday'));
});

test('every movie comes after its own prerequisites', async () => {
  const movies = (await call('GET', '/movies')).body;
  const byId = new Map(movies.map((m) => [m.id, m]));
  const res = await call('GET', `/movies/${ids['Avengers: Doomsday']}/rewatch-order`);
  const position = new Map(res.body.order.map((m, i) => [m.id, i]));
  for (const m of res.body.order) {
    for (const p of byId.get(m.id).prerequisites) {
      assert.ok(position.get(p) < position.get(m.id), `${p} must precede ${m.id}`);
    }
  }
});

test('rewatch order for Civil War', async () => {
  const res = await call('GET', `/movies/${ids['Captain America: Civil War']}/rewatch-order`);
  const t = titles(res);
  assert.equal(t.length, 3);
  assert.equal(t[2], 'The Avengers');
  assert.deepEqual(new Set(t.slice(0, 2)), new Set(['Iron Man', 'Captain America: The First Avenger']));
});

test('rewatch order for Ragnarok is empty', async () => {
  const res = await call('GET', `/movies/${ids['Thor: Ragnarok']}/rewatch-order`);
  assert.deepEqual(res.body.order, []);
  assert.equal(res.body.totalCount, 0);
  assert.equal(res.body.watchedCount, 0);
  assert.equal(res.body.unwatchedRuntimeMinutes, 0);
});

test('Endgame as prerequisite of Iron Man is a 409 CIRCULAR_DEPENDENCY', async () => {
  const res = await call('PATCH', `/movies/${ids['Iron Man']}`, {
    prerequisites: [ids['Avengers: Endgame']],
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CIRCULAR_DEPENDENCY');
  const iron = (await call('GET', `/movies/${ids['Iron Man']}`)).body;
  assert.deepEqual(iron.prerequisites, []); // unchanged
});

test('a movie cannot depend on itself', async () => {
  const res = await call('PATCH', `/movies/${ids['Iron Man']}`, { prerequisites: [ids['Iron Man']] });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CIRCULAR_DEPENDENCY');
});

test('self dependency on create (by title) is rejected', async () => {
  const res = await call('POST', '/movies', {
    title: 'Ouroboros',
    releaseYear: 2020,
    runtimeMinutes: 100,
    prerequisites: ['Ouroboros'],
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CIRCULAR_DEPENDENCY');
});

test('watched progress and remaining runtime', async () => {
  await call('PATCH', `/movies/${ids['Iron Man']}`, { watched: true });
  await call('PATCH', `/movies/${ids['Thor: Ragnarok']}`, { watched: true });
  const res = await call('GET', `/movies/${ids['Avengers: Doomsday']}/rewatch-order`);
  assert.equal(res.body.watchedCount, 2);
  assert.equal(res.body.totalCount, 7);
  // 124 + 143 + 147 + 149 + 181 = 744 (Iron Man 126 and Ragnarok 130 are watched)
  assert.equal(res.body.unwatchedRuntimeMinutes, 744);
});

test('titles are unique, ignoring case', async () => {
  const res = await call('POST', '/movies', { title: 'iron man', releaseYear: 2008, runtimeMinutes: 126 });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'DUPLICATE_TITLE');
});

test('runtime must be between 1 and 300', async () => {
  for (const runtimeMinutes of [0, 301, 12.5, '120']) {
    const res = await call('POST', '/movies', { title: `Bad ${runtimeMinutes}`, releaseYear: 2020, runtimeMinutes });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('unknown prerequisite is a 400, unknown movie is a 404', async () => {
  const a = await call('PATCH', `/movies/${ids['Iron Man']}`, { prerequisites: [9999] });
  assert.equal(a.status, 400);
  const b = await call('GET', '/movies/9999/rewatch-order');
  assert.equal(b.status, 404);
});

test('a batch create is all or nothing', async () => {
  const before = (await call('GET', '/movies')).body.length;
  const res = await call('POST', '/movies', [
    { title: 'Batch A', releaseYear: 2020, runtimeMinutes: 100 },
    { title: 'Batch B', releaseYear: 2020, runtimeMinutes: 0 },
  ]);
  assert.equal(res.status, 400);
  assert.equal((await call('GET', '/movies')).body.length, before);
});

test('a batch can reference earlier movies by title', async () => {
  const res = await call('POST', '/movies', [
    { title: 'Batch One', releaseYear: 2020, runtimeMinutes: 90 },
    { title: 'Batch Two', releaseYear: 2021, runtimeMinutes: 95, prerequisites: ['Batch One'] },
  ]);
  assert.equal(res.status, 201);
  assert.deepEqual(res.body[1].prerequisites, [res.body[0].id]);
});

test('indirect cycles are caught after prerequisites change later', async () => {
  const a = (await call('POST', '/movies', { title: 'Cycle A', releaseYear: 2020, runtimeMinutes: 90 })).body;
  const b = (await call('POST', '/movies', {
    title: 'Cycle B', releaseYear: 2020, runtimeMinutes: 90, prerequisites: [a.id],
  })).body;
  const c = (await call('POST', '/movies', {
    title: 'Cycle C', releaseYear: 2020, runtimeMinutes: 90, prerequisites: [b.id],
  })).body;
  const res = await call('PATCH', `/movies/${a.id}`, { prerequisites: [c.id] });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CIRCULAR_DEPENDENCY');
});

test('a diamond shaped graph lists the shared movie once', async () => {
  const root = (await call('POST', '/movies', { title: 'D root', releaseYear: 2020, runtimeMinutes: 10 })).body;
  const left = (await call('POST', '/movies', {
    title: 'D left', releaseYear: 2020, runtimeMinutes: 10, prerequisites: [root.id],
  })).body;
  const right = (await call('POST', '/movies', {
    title: 'D right', releaseYear: 2020, runtimeMinutes: 10, prerequisites: [root.id],
  })).body;
  const top = (await call('POST', '/movies', {
    title: 'D top', releaseYear: 2020, runtimeMinutes: 10, prerequisites: [left.id, right.id],
  })).body;
  const res = await call('GET', `/movies/${top.id}/rewatch-order`);
  assert.deepEqual(titles(res), ['D root', 'D left', 'D right']);
});

test('a very long prerequisite chain does not overflow the stack', async () => {
  const { rewatchOrder, wouldCreateCycle } = require('../src/graph');
  const N = 100000;
  const prereqs = (id) => (id === 0 ? [] : [id - 1]);
  const order = rewatchOrder(N, prereqs);
  assert.equal(order.length, N);
  assert.equal(order[0], 0);
  assert.equal(wouldCreateCycle(0, [N], prereqs), true);
});

// ---------- Feature 2 ----------

async function makeCinema(name, bundleSizes) {
  const res = await call('POST', '/cinemas', { name, bundleSizes });
  assert.equal(res.status, 201);
  return res.body;
}

const asMap = (res) => Object.fromEntries(res.body.bundles.map((b) => [b.size, b.count]));

test('booking: 1, 3, 4 for 6 gives 2 bundles (3 x 2)', async () => {
  const c = await makeCinema('T1', [1, 3, 4]);
  const res = await call('GET', `/cinemas/${c.id}/booking?groupSize=6`);
  assert.equal(res.body.possible, true);
  assert.equal(res.body.totalBundles, 2);
  assert.deepEqual(asMap(res), { 3: 2 });
});

test('booking: 2, 5 for 11 gives 4 bundles (5 x 1, 2 x 3)', async () => {
  const c = await makeCinema('T2', [2, 5]);
  const res = await call('GET', `/cinemas/${c.id}/booking?groupSize=11`);
  assert.equal(res.body.totalBundles, 4);
  assert.deepEqual(asMap(res), { 5: 1, 2: 3 });
});

test('booking: 6, 9, 20 for 44 gives 4 bundles (20 x 1, 9 x 2, 6 x 1)', async () => {
  const c = await makeCinema('T3', [6, 9, 20]);
  const res = await call('GET', `/cinemas/${c.id}/booking?groupSize=44`);
  assert.equal(res.body.totalBundles, 4);
  assert.deepEqual(asMap(res), { 20: 1, 9: 2, 6: 1 });
});

test('booking: 4, 6 for 7 is not possible', async () => {
  const c = await makeCinema('T4', [4, 6]);
  const res = await call('GET', `/cinemas/${c.id}/booking?groupSize=7`);
  assert.equal(res.status, 200);
  assert.equal(res.body.possible, false);
  assert.deepEqual(res.body.bundles, []);
  assert.match(res.body.message, /Not possible/);
});

test('booking results always add up to the group size', async () => {
  const c = await makeCinema('T5', [7, 13, 499, 500]);
  for (const g of [1, 7, 20, 26, 499, 1000, 4999, 10000]) {
    const res = await call('GET', `/cinemas/${c.id}/booking?groupSize=${g}`);
    if (res.body.possible) {
      const seats = res.body.bundles.reduce((s, b) => s + b.size * b.count, 0);
      const count = res.body.bundles.reduce((s, b) => s + b.count, 0);
      assert.equal(seats, g);
      assert.equal(count, res.body.totalBundles);
    }
  }
});

test('group size outside 1 to 10000 is rejected', async () => {
  const c = await makeCinema('T6', [2]);
  for (const g of ['0', '10001', 'abc', '-3', '2.5', '']) {
    const res = await call('GET', `/cinemas/${c.id}/booking?groupSize=${g}`);
    assert.equal(res.status, 400, `groupSize=${g}`);
  }
  assert.equal((await call('GET', `/cinemas/${c.id}/booking`)).status, 400);
  assert.equal((await call('GET', `/cinemas/${c.id}/booking?groupSize=10000`)).status, 200);
});

test('cinema validation', async () => {
  const bad = [
    { name: '', bundleSizes: [2] },
    { name: 'X', bundleSizes: [] },
    { name: 'X', bundleSizes: [0] },
    { name: 'X', bundleSizes: [501] },
    { name: 'X', bundleSizes: [2, 2] },
    { name: 'X', bundleSizes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { name: 'X' },
  ];
  for (const body of bad) {
    const res = await call('POST', '/cinemas', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const ok = await call('POST', '/cinemas', { name: 'Ten', bundleSizes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  assert.equal(ok.status, 201);
  const dup = await call('POST', '/cinemas', { name: 'ten', bundleSizes: [2] });
  assert.equal(dup.status, 409);
});

test('invalid JSON gives a 400', async () => {
  const res = await fetch(`${base}/api/movies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ not json',
  });
  assert.equal(res.status, 400);
});

// ---------- Posters (optional extra) ----------

test('sample movies come with poster paths', async () => {
  const movies = (await call('GET', '/movies')).body;
  const iron = movies.find((m) => m.title === 'Iron Man');
  assert.equal(iron.posterUrl, '/posters/iron-man.jpg');
});

test('posterUrl is optional, defaults to null, and can be set and cleared', async () => {
  const made = await call('POST', '/movies', { title: 'No Poster', releaseYear: 2020, runtimeMinutes: 90 });
  assert.equal(made.status, 201);
  assert.equal(made.body.posterUrl, null);

  const set = await call('PATCH', `/movies/${made.body.id}`, { posterUrl: 'https://example.com/p.jpg' });
  assert.equal(set.body.posterUrl, 'https://example.com/p.jpg');

  const cleared = await call('PATCH', `/movies/${made.body.id}`, { posterUrl: null });
  assert.equal(cleared.body.posterUrl, null);
});

test('invalid posterUrl is rejected', async () => {
  for (const posterUrl of ['not a url', 'javascript:alert(1)', 123, '/has space.jpg']) {
    const res = await call('POST', '/movies', {
      title: `Bad poster ${posterUrl}`, releaseYear: 2020, runtimeMinutes: 90, posterUrl,
    });
    assert.equal(res.status, 400, String(posterUrl));
  }
});

test('applyPosters fills missing posters but keeps chosen ones', () => {
  const { applyPosters } = require('../src/seed');
  const state = {
    movies: [
      { title: 'Iron Man', posterUrl: null },
      { title: 'Thor: Ragnarok', posterUrl: 'https://example.com/mine.jpg' },
      { title: 'Unknown Movie', posterUrl: null },
    ],
  };
  applyPosters(state);
  assert.equal(state.movies[0].posterUrl, '/posters/iron-man.jpg');
  assert.equal(state.movies[1].posterUrl, 'https://example.com/mine.jpg');
  assert.equal(state.movies[2].posterUrl, null);
});
