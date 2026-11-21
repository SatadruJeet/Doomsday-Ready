import React, { useState } from 'react';
import { api, describeError, formatMinutes } from '../api.js';
import Poster from '../components/Poster.jsx';

/** A list of checkboxes for choosing prerequisites. */
function PrerequisitePicker({ movies, selected, onChange, excludeId }) {
  const options = movies.filter((m) => m.id !== excludeId);
  if (options.length === 0) return <p className="muted">No other movies yet.</p>;

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="picker">
      {options.map((m) => (
        <label key={m.id} className="check">
          <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
          {m.title}
        </label>
      ))}
    </div>
  );
}

function AddMovieForm({ movies, reload }) {
  const empty = { title: '', releaseYear: '', runtimeMinutes: '', posterUrl: '', prerequisites: [] };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createMovie({
        title: form.title,
        releaseYear: Number(form.releaseYear),
        runtimeMinutes: Number(form.runtimeMinutes),
        posterUrl: form.posterUrl.trim() === '' ? null : form.posterUrl.trim(),
        prerequisites: form.prerequisites,
      });
      setForm(empty);
      await reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Add a movie</h2>
      <div className="row">
        <label className="field grow">
          Title
          <input value={form.title} onChange={set('title')} required maxLength={200} />
        </label>
        <label className="field">
          Release year
          <input type="number" value={form.releaseYear} onChange={set('releaseYear')} required min="1888" max="2100" />
        </label>
        <label className="field">
          Runtime (minutes)
          <input type="number" value={form.runtimeMinutes} onChange={set('runtimeMinutes')} required min="1" max="300" />
        </label>
      </div>
      <label className="field">
        Poster link (optional, for example /posters/my-movie.jpg or an https link)
        <input value={form.posterUrl} onChange={set('posterUrl')} />
      </label>
      <fieldset>
        <legend>Watch these first (optional)</legend>
        <PrerequisitePicker
          movies={movies}
          selected={form.prerequisites}
          onChange={(prerequisites) => setForm({ ...form, prerequisites })}
        />
      </fieldset>
      {error && <div className="banner error">{error}</div>}
      <button className="primary" disabled={busy}>
        {busy ? 'Adding...' : 'Add movie'}
      </button>
    </form>
  );
}

function MovieRow({ movie, movies, reload }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(movie.prerequisites);
  const [error, setError] = useState('');

  const byId = new Map(movies.map((m) => [m.id, m]));

  async function toggleWatched() {
    setError('');
    try {
      await api.updateMovie(movie.id, { watched: !movie.watched });
      await reload();
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function savePrerequisites() {
    setError('');
    try {
      await api.updateMovie(movie.id, { prerequisites: selected });
      setEditing(false);
      await reload();
    } catch (err) {
      setError(describeError(err));
    }
  }

  function startEditing() {
    setSelected(movie.prerequisites);
    setError('');
    setEditing(true);
  }

  return (
    <li className={movie.watched ? 'movie watched' : 'movie'}>
      <Poster movie={movie} />
      <div className="movie-body">
        <div className="movie-head">
          <label className="check big">
            <input type="checkbox" checked={movie.watched} onChange={toggleWatched} />
            <span className="title">{movie.title}</span>
          </label>
          <span className="meta">
            {movie.releaseYear} · {formatMinutes(movie.runtimeMinutes)}
          </span>
          {!editing && (
            <button className="link" onClick={startEditing}>
              Edit prerequisites
            </button>
          )}
        </div>

        {!editing && (
          <p className="prereqs">
            {movie.prerequisites.length === 0
              ? 'No prerequisites'
              : `Watch first: ${movie.prerequisites.map((id) => byId.get(id)?.title).join(', ')}`}
          </p>
        )}

        {editing && (
          <div className="edit">
            <PrerequisitePicker movies={movies} selected={selected} onChange={setSelected} excludeId={movie.id} />
            <div className="row">
              <button className="primary" onClick={savePrerequisites}>
                Save
              </button>
              <button onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        )}

        {error && <div className="banner error">{error}</div>}
      </div>
    </li>
  );
}

export default function MoviesView({ movies, reload }) {
  const watchedCount = movies.filter((m) => m.watched).length;

  return (
    <div className="stack">
      <AddMovieForm movies={movies} reload={reload} />
      <section className="card">
        <h2>
          Movies <span className="muted">({watchedCount} of {movies.length} watched)</span>
        </h2>
        {movies.length === 0 ? (
          <p className="muted">No movies yet. Add the first one above.</p>
        ) : (
          <ul className="movies">
            {movies.map((m) => (
              <MovieRow key={m.id} movie={m} movies={movies} reload={reload} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
