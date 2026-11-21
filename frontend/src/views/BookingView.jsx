import React, { useState } from 'react';
import { api, describeError } from '../api.js';

function AddCinemaForm({ reload }) {
  const [name, setName] = useState('');
  const [sizes, setSizes] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const bundleSizes = sizes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number);
      await api.createCinema({ name, bundleSizes });
      setName('');
      setSizes('');
      await reload();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Add a cinema</h2>
      <div className="row">
        <label className="field grow">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field grow">
          Bundle sizes (comma separated)
          <input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="2, 5" required />
        </label>
      </div>
      {error && <div className="banner error">{error}</div>}
      <button className="primary">Add cinema</button>
    </form>
  );
}

export default function BookingView({ cinemas, reload }) {
  const [cinemaId, setCinemaId] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');

  const cinema = cinemas.find((c) => String(c.id) === cinemaId);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setQuote(null);
    try {
      setQuote(await api.booking(cinemaId, groupSize));
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="stack">
      <form className="card" onSubmit={submit}>
        <h2>Book the opening night</h2>
        <div className="row">
          <label className="field grow">
            Cinema
            <select value={cinemaId} onChange={(e) => { setCinemaId(e.target.value); setQuote(null); }} required>
              <option value="">Choose a cinema...</option>
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Group size
            <input
              type="number"
              min="1"
              max="10000"
              value={groupSize}
              onChange={(e) => setGroupSize(e.target.value)}
              required
            />
          </label>
        </div>
        {cinema && <p className="muted">Sells bundles of {cinema.bundleSizes.join(', ')} seats.</p>}
        <button className="primary">Get my quote</button>
      </form>

      {error && <div className="banner error">{error}</div>}

      {quote && (
        <section className="card">
          <h2>Your quote</h2>
          {quote.possible ? (
            <>
              <p className="big-number">
                {quote.totalBundles} {quote.totalBundles === 1 ? 'bundle' : 'bundles'}
              </p>
              <ul className="bundles">
                {quote.bundles.map((b) => (
                  <li key={b.size}>
                    <strong>{b.count}</strong> × bundle of <strong>{b.size}</strong> seats
                    <span className="muted"> ({b.count * b.size} seats)</span>
                  </li>
                ))}
              </ul>
              <p className="muted">Total: {quote.groupSize} seats, no empty seats.</p>
            </>
          ) : (
            <div className="banner error">
              <strong>Not possible.</strong> {quote.message}
            </div>
          )}
        </section>
      )}

      <AddCinemaForm reload={reload} />
    </div>
  );
}
