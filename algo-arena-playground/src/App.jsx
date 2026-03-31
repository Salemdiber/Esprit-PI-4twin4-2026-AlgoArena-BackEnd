import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import ChallengeCard from './components/ChallengeCard.jsx';
import ChallengeDetail from './components/ChallengeDetail.jsx';
import CodeEditor from './components/CodeEditor.jsx';
import OutputPanel from './components/OutputPanel.jsx';
import { fetchChallenges, fetchChallengeById, runCode } from './services/api.js';
import './App.css';

const DEFAULT_CODE = {
  javascript: `// Welcome to AlgoArena Playground!
// Select a challenge on the left, or just write code below.
// Press Ctrl+Enter to run.

function solution(input) {
  console.log("Hello, AlgoArena!", input);
  return input;
}
`,
  python: `# Welcome to AlgoArena Playground!
# Select a challenge on the left, or write code below.

def solution(input):
    print("Hello, AlgoArena!", input)
    return input
`,
  java: `// Welcome to AlgoArena Playground!
// Note: Java execution is simulated in this environment.

public class Solution {
    public static void main(String[] args) {
        System.out.println("Hello, AlgoArena!");
    }
}
`,
};

export default function App() {
  // Challenge list
  const [challenges, setChallenges] = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [challengesError, setChallengesError] = useState(null);

  // Selected challenge
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Editor state
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(DEFAULT_CODE['javascript']);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);

  // Search
  const [search, setSearch] = useState('');
  const [filterDiff, setFilterDiff] = useState('All');

  // Load challenges on mount
  useEffect(() => {
    setChallengesLoading(true);
    fetchChallenges()
      .then((data) => {
        setChallenges(data);
        setChallengesError(null);
      })
      .catch((err) => setChallengesError(err.message))
      .finally(() => setChallengesLoading(false));
  }, []);

  // Select a challenge
  const handleSelectChallenge = useCallback(async (challenge) => {
    if (selectedChallenge?._id === challenge._id) return;

    setDetailLoading(true);
    setDetailError(null);
    setRunResult(null);
    setRunError(null);

    try {
      const detail = await fetchChallengeById(challenge._id);
      setSelectedChallenge(detail);

      // Set starter code for current language
      const starter = detail.starterCode?.[language] || DEFAULT_CODE[language];
      setCode(starter);
    } catch (err) {
      setDetailError(err.message);
      setSelectedChallenge(challenge); // fallback to list data
    } finally {
      setDetailLoading(false);
    }
  }, [selectedChallenge, language]);

  // Change language — update code to starter for that language
  const handleLanguageChange = useCallback((newLang) => {
    setLanguage(newLang);
    if (selectedChallenge?.starterCode) {
      const starter = selectedChallenge.starterCode[newLang] || DEFAULT_CODE[newLang];
      setCode(starter);
    } else {
      setCode(DEFAULT_CODE[newLang] || '');
    }
    setRunResult(null);
    setRunError(null);
  }, [selectedChallenge]);

  // Reset code to starter
  const handleReset = useCallback(() => {
    if (selectedChallenge?.starterCode?.[language]) {
      setCode(selectedChallenge.starterCode[language]);
    } else {
      setCode(DEFAULT_CODE[language] || '');
    }
    setRunResult(null);
    setRunError(null);
  }, [selectedChallenge, language]);

  // Run code
  const handleRun = useCallback(async () => {
    if (isRunning || !code.trim()) return;
    setIsRunning(true);
    setRunResult(null);
    setRunError(null);

    try {
      const result = await runCode({
        code,
        language,
        challengeId: selectedChallenge?._id,
      });
      setRunResult(result);
    } catch (err) {
      setRunError(err.message);
    } finally {
      setIsRunning(false);
    }
  }, [code, language, selectedChallenge, isRunning]);

  // Filter challenges
  const filteredChallenges = challenges.filter((c) => {
    const matchSearch = !search || c.title?.toLowerCase().includes(search.toLowerCase());
    const matchDiff = filterDiff === 'All' || c.difficulty === filterDiff;
    return matchSearch && matchDiff;
  });

  return (
    <div className="app">
      <Navbar />

      <div className="app-body">
        {/* ── Left panel: challenge list ── */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2 className="sidebar-title">Challenges</h2>
            {!challengesLoading && (
              <span className="challenge-count">{filteredChallenges.length}</span>
            )}
          </div>

          <div className="sidebar-filters">
            <div className="search-wrap">
              <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search challenges…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                id="challenge-search"
                aria-label="Search challenges"
              />
              {search && (
                <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
              )}
            </div>

            <div className="diff-filters">
              {['All', 'Easy', 'Medium', 'Hard'].map((d) => (
                <button
                  key={d}
                  className={`btn btn-ghost diff-btn ${filterDiff === d ? 'active' : ''}`}
                  onClick={() => setFilterDiff(d)}
                  id={`filter-${d.toLowerCase()}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="challenge-list">
            {challengesLoading && (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="challenge-skeleton">
                    <div className="skeleton" style={{ height: '16px', width: '70%', marginBottom: '8px' }} />
                    <div className="skeleton" style={{ height: '12px', width: '100%', marginBottom: '4px' }} />
                    <div className="skeleton" style={{ height: '12px', width: '80%' }} />
                  </div>
                ))}
              </>
            )}

            {!challengesLoading && challengesError && (
              <div className="list-error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p>{challengesError}</p>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setChallengesLoading(true); fetchChallenges().then(setChallenges).catch((e) => setChallengesError(e.message)).finally(() => setChallengesLoading(false)); }}
                >
                  Retry
                </button>
              </div>
            )}

            {!challengesLoading && !challengesError && filteredChallenges.length === 0 && (
              <div className="list-empty">
                <p>No challenges found</p>
                {search && <button className="btn btn-ghost" onClick={() => setSearch('')}>Clear search</button>}
              </div>
            )}

            {!challengesLoading && filteredChallenges.map((c, i) => (
              <div key={c._id} style={{ animationDelay: `${i * 40}ms` }}>
                <ChallengeCard
                  challenge={c}
                  isActive={selectedChallenge?._id === c._id}
                  onClick={() => handleSelectChallenge(c)}
                />
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main area ── */}
        <main className="main-area">
          {/* Challenge detail / hero */}
          <div className="detail-pane">
            {detailLoading && (
              <div className="detail-loading">
                <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }} />
                <span>Loading challenge…</span>
              </div>
            )}
            {!detailLoading && !selectedChallenge && (
              <div className="hero-empty">
                <div className="hero-icon">{'</>'}</div>
                <h2>Try a Challenge Instantly</h2>
                <p>No sign-up needed. Select a challenge, write code, hit run, and see the results.</p>
                <div className="hero-features">
                  <div className="feature">
                    <span className="feature-icon">⚡</span>
                    <span>Instant execution</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">🎯</span>
                    <span>Test case validation</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">🌐</span>
                    <span>Multi-language support</span>
                  </div>
                </div>
              </div>
            )}
            {!detailLoading && selectedChallenge && (
              <ChallengeDetail challenge={selectedChallenge} />
            )}
          </div>

          {/* Editor + Output */}
          <div className="editor-area">
            <div className="editor-pane">
              <CodeEditor
                code={code}
                language={language}
                onCodeChange={setCode}
                onLanguageChange={handleLanguageChange}
                onRun={handleRun}
                onReset={handleReset}
                isRunning={isRunning}
                availableLanguages={
                  selectedChallenge?.languages?.length
                    ? selectedChallenge.languages
                    : ['javascript', 'python', 'java']
                }
              />
            </div>

            <div className="output-pane">
              <OutputPanel
                result={runResult}
                isRunning={isRunning}
                error={runError}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
