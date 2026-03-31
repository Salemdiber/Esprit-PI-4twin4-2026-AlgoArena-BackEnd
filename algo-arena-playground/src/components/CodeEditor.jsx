import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './CodeEditor.css';

const LANG_MONACO = {
  javascript: 'javascript',
  python: 'python',
  java: 'java',
};

const LANG_LABELS = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
};

export default function CodeEditor({
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onRun,
  onReset,
  isRunning,
  availableLanguages = ['javascript', 'python', 'java'],
}) {
  const editorRef = useRef(null);

  function handleEditorDidMount(editor) {
    editorRef.current = editor;
    // Add Ctrl+Enter shortcut to run code
    editor.addCommand(
      // 2048 is Monaco's Ctrl modifier
      2048 | 3, // Ctrl + Enter
      () => { if (!isRunning) onRun(); }
    );
  }

  return (
    <div className="code-editor-wrapper">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <div className="editor-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>

          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="lang-select"
            aria-label="Select programming language"
            id="language-selector"
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>{LANG_LABELS[lang] || lang}</option>
            ))}
          </select>
        </div>

        <div className="editor-toolbar-right">
          <button
            className="btn btn-ghost toolbar-btn"
            onClick={onReset}
            title="Reset to starter code"
            aria-label="Reset to starter code"
            id="reset-code-btn"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.36" />
            </svg>
            Reset
          </button>

          <button
            className="btn btn-run"
            onClick={onRun}
            disabled={isRunning}
            id="run-code-btn"
            aria-label="Run code (Ctrl+Enter)"
          >
            {isRunning ? (
              <>
                <span className="spinner" />
                Running…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Run Code
              </>
            )}
          </button>
        </div>
      </div>

      <div className="editor-body">
        <Editor
          height="100%"
          language={LANG_MONACO[language] || 'javascript'}
          value={code}
          onChange={onCodeChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            padding: { top: 16, bottom: 16 },
            wordWrap: 'on',
            tabSize: 2,
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
          }}
        />
      </div>

      <div className="editor-hint">
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to run
      </div>
    </div>
  );
}
