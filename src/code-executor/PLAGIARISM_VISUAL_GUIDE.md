# 🔍 Plagiarism Detection System - Visual Architecture

```mermaid
graph TD
    A[Speed Challenge Submission] --> B{Code Validation}
    B -->|Failed| C["❌ Reject<br/>No Plagiarism Check"]
    B -->|Passed| D["🔍 Start Plagiarism Detection"]
    
    D --> E["1️⃣ Hash Detection<br/>20% weight"]
    D --> F["2️⃣ AST Analysis<br/>30% weight"]
    D --> G["3️⃣ Token Similarity<br/>25% weight"]
    D --> H["4️⃣ AI Patterns<br/>25% weight"]
    
    E --> E1["SHA-256 Hash<br/>Full Code"]
    E --> E2["Normalized Hash<br/>Whitespace Removed"]
    E --> E3["Trimmed Hash<br/>All Whitespace Removed"]
    
    F --> F1["Parse to AST<br/>using Babel"]
    F --> F2["Compare Function<br/>Signatures"]
    F --> F3["Analyze Control<br/>Flow"]
    
    G --> G1["Tokenize Code<br/>Remove Strings/Numbers"]
    G --> G2["Jaccard Index<br/>Token Similarity"]
    G --> G3["Cosine Similarity<br/>Token Distribution"]
    
    H --> H1["Variable<br/>Renaming?"]
    H --> H2["Logic<br/>Identical?"]
    H --> H3["Structure<br/>Identical?"]
    H --> H4["Whitespace<br/>Manip?"]
    
    E1 --> I["Calculate Weighted Score"]
    E2 --> I
    E3 --> I
    F1 --> I
    F2 --> I
    F3 --> I
    G1 --> I
    G2 --> I
    G3 --> I
    H1 --> I
    H2 --> I
    H3 --> I
    H4 --> I
    
    I --> J["Overall Similarity %<br/>0-100"]
    
    J --> K{Decision Tree}
    
    K -->|< 60%| L["✅ CLEAR<br/>Pass"]
    K -->|60-75%| M["📋 REVIEW<br/>Flag for Manual Check"]
    K -->|> 75%| N["⚠️ SUSPICIOUS<br/>Likely Plagiarism"]
    K -->|2+ Techniques<br/>Above Threshold| N
    
    L --> O[Save Submission]
    M --> P["Queue for<br/>Administrator Review"]
    N --> Q["Flag User<br/>Record Incident"]
    
    style A fill:#e1f5ff
    style E fill:#fff3e0
    style F fill:#f3e5f5
    style G fill:#e8f5e9
    style H fill:#fce4ec
    style J fill:#fffde7
    style L fill:#c8e6c9
    style M fill:#fff9c4
    style N fill:#ffccbc
```

---

## Detection Flow for Each Technique

### 1️⃣ Hash-Based Detection (Fast ⚡)
```
Submitted Code: function solve(n) { return n * 2; }
Reference Code: function solve(n) { return n * 2; }
          ↓
SHA-256 Hash          → Same = 100%
Normalized Hash       → Same = 95%
Trimmed Hash          → Same = 90%
          ↓
Result: MATCH ✅ Exact copy detected
```

### 2️⃣ AST Analysis (Structure ⚡⚡)
```
Submitted: function verify(x) { let s=0; for(let i=0;i<x;i++) s+=i; return s; }
Reference: function compute(num) { let sum=0; for(let j=0;j<num;j++) sum+=j; return sum; }
           ↓
Parse both to AST
           ↓
Compare:
- Function Count: 1 vs 1 ✓
- Parameters: 1 vs 1 ✓
- Loops: for vs for ✓
- Conditionals: 0 vs 0 ✓
           ↓
Structure Similarity: 92%
```

### 3️⃣ Token Similarity (Algorithm ⚡⚡)
```
Submitted after tokenization:
[const, fib, =, n, =>, n, <=, 1, return, n, return, fib, ...]

Reference after tokenization:
[const, fibonacci, =, x, =>, x, <=, 1, return, x, return, fibonacci, ...]

Common tokens: for, if, return, <=, etc.
Common pool size: 18
Total unique: 24
Jaccard Index: 18/24 = 75%
Cosine Similarity: 82%
Average: 78%
           ↓
Result: Similar algorithm detected
```

### 4️⃣ AI Pattern Detection (Intelligent 🤖)
```
Pattern 1: Variable Renaming
   Submitted vars: [verify, x, s, i]
   Reference vars: [compute, num, sum, j]
   Structure: IDENTICAL
   → Confidence: 85% = SUSPICIOUS

Pattern 2: Logic Identical
   After variable substitution:
   Submitted:  VAR VAR = NUM; for(VAR = NUM; VAR < VAR; VAR++) VAR += VAR; return VAR;
   Reference:  VAR VAR = NUM; for(VAR = NUM; VAR < VAR; VAR++) VAR += VAR; return VAR;
   → Match: 100% = HIGHLY SUSPICIOUS

Pattern 3: Structure Identical
   Code structure: F C R F C R F
   Both have: Function, Conditional, Return pattern
   → Confidence: 88%

Pattern 4: Whitespace Manipulation
   Clean comparison (no whitespace):
   Submitted:  varconstfib=n=>n<=1returnnreturnfib...
   Reference:  varconstfib=n=>n<=1returnnreturnfib...
   → Same: 99% = EXACT
```

---

## Scoring Example: Variable Renaming Case

```
Input:
  Reference: function solution(n) { let sum=0; for(let i=0;i<n;i++) sum+=i; return sum; }
  Submitted: function solve(x) { let total=0; for(let j=0;j<x;j++) total+=j; return total; }

Technique Scores:
  1. Hash:     0% (different variable names)
  2. AST:      92% (identical structure)
  3. Token:    85% (same algorithm pattern)
  4. AI:       85% (variable renaming detected)

Weighted Average:
  (0 × 0.20) + (92 × 0.30) + (85 × 0.25) + (85 × 0.25)
  = 0 + 27.6 + 21.25 + 21.25
  = 70.1%

Result: 70% overall → REVIEW or SUSPICIOUS ⚠️
```

---

## Performance Metrics

```mermaid
gantt
    title Plagiarism Detection Performance
    dateFormat YYYY-MM-DD
    
    Hash Analysis        :h, 2026-03-26, 1ms
    AST Parsing         :a, after h, 50ms
    Token Analysis      :t, after a, 100ms
    AI Pattern Detect   :ai, after t, 200ms
    
    Scoring & Report    :s, after ai, 10ms
```

**Total per Comparison: ~350ms**
**Bulk Check (30 submissions): ~3 minutes for all pairs**

---

## Detection Confidence Heatmap

```
Similarity %    Clear ✅          Review 📋         Suspicious ⚠️
70-80%         Variable Renaming  Use AI Check    Consider Context
80-90%         Unlikely          Monitor         Likely Plagiarism
90-100%        Very Rare         High Alert      Definite Match
```

---

## Integration with Speed Challenge Flow

```mermaid
sequenceDiagram
    User->>SpeedChallenge: Submit Code
    SpeedChallenge->>CodeValidator: Validate Code
    CodeValidator-->>SpeedChallenge: Tests Result
    
    alt Tests Pass
        SpeedChallenge->>PlagiarismDetection: Check Against Previous
        PlagiarismDetection->>Hash: Compare Hashes
        PlagiarismDetection->>AST: Compare Structure
        PlagiarismDetection->>Token: Calculate Similarity
        PlagiarismDetection->>AI: Detect Patterns
        
        Hash-->>PlagiarismDetection: 0%
        AST-->>PlagiarismDetection: 92%
        Token-->>PlagiarismDetection: 85%
        AI-->>PlagiarismDetection: 85%
        
        PlagiarismDetection-->>SpeedChallenge: Result (Suspicious)
        
        alt Plagiarism Detected
            SpeedChallenge->>Admin: Flag for Review
            SpeedChallenge-->>User: ⚠️ Solution Flagged
        else Clean
            SpeedChallenge->>Database: Save Valid Solution
            SpeedChallenge-->>User: ✅ Solution Accepted
        end
    else Tests Fail
        SpeedChallenge-->>User: ❌ Tests Failed
    end
```
