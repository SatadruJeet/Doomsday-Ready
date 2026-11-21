import React, { useCallback, useEffect, useState } from 'react';
import { api, describeError, formatMinutes } from '../api.js';
import Poster from '../components/Poster.jsx';

export default function RewatchView({ movies, reload }) {
  const [targetId, setTargetId] = useState('');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');

  const loadPlan = useCallback(async (id) => {
    if (!id) {
      setPlan(null);
      return;
    }
    try {
      setPlan(await api.rewatchOrder(id));
      setError('');
    } catch (err) {
      setPlan(null);
      setError(describeError(err));
    }
  }, []);

  useEffect(() => {
    loadPlan(targetId);
  }, [targetId, movies, loadPlan]);

  async function toggle(movie) {
    try {
      await api.updateMovie(movie.id, { watched: !movie.watched });
      await reload(); // refreshing movies re-triggers the plan above
    } catch (err) {
      setError(describeError(err));
    }
  }

  const targetMovie = movies.find((m) => String(m.id) === targetId);
  const percent = plan && plan.totalCount > 0 ? Math.round((plan.watchedCount / plan.totalCount) * 100) : 0;

  return (
    <div className="stack">
      <section className="card">
        <h2>Rewatch plan</h2>
        <label className="field">
          What do you want to watch next?
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Choose a movie...</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        {movies.length === 0 && <p className="muted">Add some movies first.</p>}
      </section>

      {error && <div className="banner error">{error}</div>}

      {plan && (
        <section className="card">
          <div className="target-head">
            {targetMovie && <Poster movie={targetMovie} />}
            <h2>Before you watch {plan.target.title}</h2>
          </div>

          {plan.totalCount === 0 ? (
            <p>Nothing to catch up on. You can watch this one right away.</p>
          ) : (
            <>
              <div className="progress-label">
                <strong>
                  {plan.watchedCount} of {plan.totalCount} watched
                </strong>
                <span>
                  {plan.unwatchedRuntimeMinutes === 0
                    ? 'All caught up'
                    : `${formatMinutes(plan.unwatchedRuntimeMinutes)} left (${plan.unwatchedRuntimeMinutes} min)`}
                </span>
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={plan.totalCount}
                aria-valuenow={plan.watchedCount}
              >
                <div className="progress-bar" style={{ width: `${percent}%` }} />
              </div>

              <ol className="plan">
                {plan.order.map((m, index) => (
                  <li key={m.id} className={m.watched ? 'watched' : ''}>
                    <span className="step">{index + 1}</span>
                    <Poster movie={m} size="sm" />
                    <label className="check big">
                      <input type="checkbox" checked={m.watched} onChange={() => toggle(m)} />
                      <span className="title">{m.title}</span>
                    </label>
                    <span className="meta">
                      {m.releaseYear} · {formatMinutes(m.runtimeMinutes)}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}
    </div>
  );
}
