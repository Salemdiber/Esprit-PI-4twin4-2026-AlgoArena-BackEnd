import React from 'react';
import './Navbar.css';

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <span className="brand-icon">{'<>'}</span>
          <span className="brand-name">AlgoArena</span>
          <span className="brand-badge">Playground</span>
        </div>
        <div className="navbar-center">
          <span className="nav-subtitle">No sign-up needed · Write code · Hit run · See results</span>
        </div>
        <div className="navbar-right">
          <a
            href="http://localhost:3000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost navbar-api-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            API Docs
          </a>
        </div>
      </div>
    </header>
  );
}
