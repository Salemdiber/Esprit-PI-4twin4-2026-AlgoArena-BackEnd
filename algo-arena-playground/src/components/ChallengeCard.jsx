import React from 'react';
import './ChallengeCard.css';

const difficultyMap = {
  Easy: 'easy',
  Medium: 'medium',
  Hard: 'hard',
};

export default function ChallengeCard({ challenge, isActive, onClick }) {
  const diff = challenge.difficulty || 'Easy';
  const tags = challenge.tags || [];

  return (
    <div
      className={`challenge-card ${isActive ? 'challenge-card--active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="card-header">
        <h3 className="card-title">{challenge.title}</h3>
        <span className={`badge badge-${difficultyMap[diff]}`}>{diff}</span>
      </div>

      <p className="card-desc">
        {challenge.description?.slice(0, 100)}
        {challenge.description?.length > 100 ? '…' : ''}
      </p>

      <div className="card-footer">
        <div className="card-tags">
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="badge badge-tag">{tag}</span>
          ))}
        </div>
        <div className="card-langs">
          {(challenge.languages || []).map((lang) => (
            <span key={lang} className="lang-pill">{lang}</span>
          ))}
        </div>
      </div>

      {isActive && <div className="card-active-indicator" />}
    </div>
  );
}
