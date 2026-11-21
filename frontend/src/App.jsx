import React, { useCallback, useEffect, useState } from 'react';
import { api, describeError } from './api.js';
import MoviesView from './views/MoviesView.jsx';
import RewatchView from './views/RewatchView.jsx';
import BookingView from './views/BookingView.jsx';

const TABS = [
  { id: 'movies', label: 'Movies' },
  { id: 'rewatch', label: 'Rewatch Plan' },
  { id: 'booking', label: 'Booking' },
];

export default function App() {
  const [tab, setTab] = useState('movies');
  const [movies, setMovies] = useState([]);
  const [cinemas, setCinemas] = useState([]);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([api.listMovies(), api.listCinemas()]);
      setMovies(m);
      setCinemas(c);
      setLoadError('');
    } catch (err) {
      setLoadError(`Could not reach the API. ${describeError(err)}`);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="app">
      <header className="header">
        <h1>
          Doomsday <span>Ready</span>
        </h1>
        <p>Plan your MCU rewatch and book the opening night watch party.</p>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loadError && <div className="banner error">{loadError}</div>}

      <main>
        {tab === 'movies' && <MoviesView movies={movies} reload={reload} />}
        {tab === 'rewatch' && <RewatchView movies={movies} reload={reload} />}
        {tab === 'booking' && <BookingView cinemas={cinemas} reload={reload} />}
      </main>
    </div>
  );
}
