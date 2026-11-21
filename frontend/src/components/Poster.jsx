import React, { useState } from 'react';

/** Movie poster image, with a simple placeholder when there is none or it fails to load. */
export default function Poster({ movie, size = 'md' }) {
  const [failed, setFailed] = useState(false);

  if (!movie.posterUrl || failed) {
    return (
      <div className={`poster ${size} placeholder`} aria-hidden="true">
        {movie.title.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      className={`poster ${size}`}
      src={movie.posterUrl}
      alt={`${movie.title} poster`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
