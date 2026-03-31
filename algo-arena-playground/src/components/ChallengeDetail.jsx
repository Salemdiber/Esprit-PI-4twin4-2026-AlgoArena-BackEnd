import React, { useState } from 'react';
import './ChallengeDetail.css';

export default function ChallengeDetail({ challenge }) {
  const [showExamples, setShowExamples] = useState(true);

  if (!challenge) return null;

  const diff = challenge.difficulty || 'Easy';
  const diffClass = { Easy: 'easy', Medium: 'medium', Hard: 'hard' }[diff] || 'easy';

  return (
    <div className="challenge-detail fade-in">
      <div className="detail-header">
        <div className="detail-title-row">
          <h1 className="detail-title">{challenge.title}</h1>
          <span className={`badge badge-${diffClass}`}>{diff}</span>
        </div>
        {challenge.tags && challenge.tags.length > 0 && (
          <div className="detail-tags">
            {challenge.tags.map((tag) => (
              <span key={tag} className="badge badge-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="detail-divider" />

      <div className="detail-description">
        {challenge.description?.split('\n').map((line, i) => {
          if (!line.trim()) return <br key={i} />;
          // Render lines with backtick code inline
          const parts = line.split(/(`[^`]+`)/g);
          return (
            <p key={i}>
              {parts.map((part, j) =>
                part.startsWith('`') && part.endsWith('`')
                  ? <code key={j} className="inline-code">{part.slice(1, -1)}</code>
                  : part
              )}
            </p>
          );
        })}
      </div>

      {challenge.examples && challenge.examples.length > 0 && (
        <div className="examples-section">
          <button
            className="examples-toggle"
            onClick={() => setShowExamples((v) => !v)}
          >
            <svg
              width="14" height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: showExamples ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {showExamples ? 'Hide' : 'Show'} Examples ({challenge.examples.length})
          </button>

          {showExamples && (
            <div className="examples-list">
              {challenge.examples.map((ex, i) => (
                <div key={i} className="example-block">
                  <div className="example-label">Example {i + 1}</div>
                  <div className="example-row">
                    <span className="example-key">Input:</span>
                    <code className="example-val">{ex.input}</code>
                  </div>
                  <div className="example-row">
                    <span className="example-key">Output:</span>
                    <code className="example-val output">{ex.output}</code>
                  </div>
                  {ex.explanation && (
                    <p className="example-explanation">{ex.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
