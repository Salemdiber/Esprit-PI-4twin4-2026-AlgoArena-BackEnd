import React from 'react';
import './OutputPanel.css';

export default function OutputPanel({ result, isRunning, error }) {
  const hasResult = result !== null && result !== undefined;

  return (
    <div className="output-panel">
      <div className="output-header">
        <div className="output-header-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span>Output</span>
        </div>

        {hasResult && !isRunning && (
          <div className="output-meta">
            {result.executionTime !== undefined && (
              <span className="meta-item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {result.executionTime}ms
              </span>
            )}
            {result.language && (
              <span className="meta-item lang-meta">{result.language}</span>
            )}
            {result.totalTests != null && (
              <span className={`meta-item ${result.passed ? 'tests-pass' : 'tests-fail'}`}>
                {result.passedTests}/{result.totalTests} tests
              </span>
            )}
          </div>
        )}
      </div>

      <div className="output-body">
        {isRunning && (
          <div className="output-running">
            <div className="running-dots">
              <span /><span /><span />
            </div>
            <p>Executing your code…</p>
          </div>
        )}

        {!isRunning && !hasResult && !error && (
          <div className="output-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <p>Click <strong>"Run Code"</strong> to execute and see results here…</p>
            <span className="hint-sub">Or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
          </div>
        )}

        {!isRunning && error && (
          <div className="output-error">
            <div className="error-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Error
            </div>
            <pre className="error-text">{error}</pre>
          </div>
        )}

        {!isRunning && hasResult && !error && (
          <div className="output-result fade-in">
            {/* Test summary bar */}
            {result.totalTests != null && (
              <div className={`test-summary ${result.passed ? 'test-summary--pass' : 'test-summary--fail'}`}>
                <span className="test-icon">{result.passed ? '✅' : '❌'}</span>
                <span>
                  {result.passed ? 'All tests passed!' : `${result.passedTests} of ${result.totalTests} tests passed`}
                </span>
                <div className="test-progress">
                  <div
                    className="test-progress-bar"
                    style={{ width: `${(result.passedTests / result.totalTests) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Output text */}
            {result.output && (
              <pre className="output-text">{result.output}</pre>
            )}
            {result.error && (
              <div className="output-error-inline">
                <span className="error-tag">Error</span>
                <pre>{result.error}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
