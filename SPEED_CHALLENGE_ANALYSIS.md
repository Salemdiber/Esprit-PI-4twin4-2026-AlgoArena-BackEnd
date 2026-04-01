# Speed Challenge Implementation Analysis
**Date: March 25, 2026**

---

## 1. SpeedChallengePage.jsx - Frontend Entry Point
**File**: [src/pages/Frontoffice/speedchallenge/SpeedChallengePage.jsx](SpeedChallengePage.jsx)

### Current Flow
1. **INTRO Phase**: User reads rules and clicks "Start the Challenge"
2. **CHALLENGE Phase**: User can:
   - View problem in left panel (SpeedProblemPanel.jsx)
   - Write code in editor (SpeedCodeEditor.jsx) 
   - Switch between 3 problems in tabs
   - Submit code for validation
3. **RESULT Phase**: Shows placement result with AI analysis

### Key Functions

#### `handleSubmit()` (lines ~308-355)
```typescript
// Validates code exists
if (!codes[problem.id]?.trim()) {
  setFeedback('⚠️ Please write some code before submitting.');
  return;
}

// Sets running state for 1.5 seconds
setSubmitState('running');

// MOCK VALIDATION: 75% success randomly
const isCorrect = Math.random() > 0.25;

if (isCorrect) {
  setSubmitState('success');
  onMarkSolved(problem.id);
  // Auto-advance to next problem after 1.5s
} else {
  setSubmitState('error');
  setFeedback('Some test cases failed. Review your solution.');
}
```

**ISSUE**: No actual code validation. Just random success decision.

#### `handleFinish()` (lines ~860-915)
```typescript
const used = TOTAL_SECONDS - (timeout ? 0 : secondsLeft);

// Step 1: Show fallback placement immediately
const fallback = computePlacement(solvedIds, used);
setPlacement(fallback);
setAiAnalysis(false); // false = loading

// Step 2: Async AI classification (non-blocking)
const solutions = activeProblems.map((p) => ({
  problemId: p.id,
  title: p.title,
  difficulty: p.difficulty,
  code: codes[p.id] || '',
  language: languages[p.id] || 'javascript',
  solved: solvedIds.includes(p.id),
}));

fetch('/api/classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ solutions, totalSeconds: used }),
})
  .then((r) => r.json())
  .then((aiResult) => {
    setAiAnalysis(aiResult);
    // Update user placement, mark challenge complete
    userService.updatePlacement({ rank: aiResult.rank, xp: aiResult.xp });
    userService.completeSpeedChallenge();
  });
```

**Key Points**:
- Immediately saves fallback placement for instant feedback
- Sends all solutions (code + metadata) to backend
- Updates user rank/xp after AI analysis completes
- Non-blocking: Result shown while AI thinks

---

## 2. Code Execution & Validation (MISSING)
**Status**: ❌ **NOT IMPLEMENTED**

### The Gap
- `src/code-executor/` directory exists but is **empty** 
- Frontend `handleSubmit()` uses **mock validation** (random 75% success)
- No actual test case execution against submitted code
- No validation that code matches problem requirements

### What Should Happen
1. **Input Validation**:
   - Code not empty (currently done)
   - Code not just starter code template
   - Code contains expected function/class signature

2. **Test Case Execution**:
   - Execute code with each test case input
   - Capture output and compare to expected
   - Measure runtime/memory (optional)

3. **Return Results**:
   - Pass/fail for each test case
   - Summary (X/Y test cases passed)
   - Then mark as "solved"

### Recommended Implementation Location
**Option A** (Client-side validation):
- Add to `useChallengeExecution.js` hook
- Call backend validation endpoint before marking solved
- Requires: Sandboxed execution (Node.js vm or similar)

**Option B** (Server-side execution):
- Create proper `code-executor` service in NestJS
- Endpoint: `POST /api/code/execute` 
- Returns: Test results before marking solved
- More secure (sandboxing on server)

---

## 3. AI Service - Code Analysis
**Files**: 
- Backend: [src/onboarding/onboarding.service.ts](../src/onboarding/onboarding.service.ts)
- Backend: [src/onboarding/onboarding.controller.ts](../src/onboarding/onboarding.controller.ts)
- Backend: [src/ai/ai.service.ts](../src/ai/ai.service.ts) (for challenge generation only)

### Endpoint: POST `/api/classify`
**onboarding.controller.ts lines 64-72**

```typescript
@Post('classify')
@HttpCode(200)
async classify(@Body() body: { solutions: SolutionInput[]; totalSeconds: number }) {
  const { solutions = [], totalSeconds = 900 } = body;
  const result = await this.onboardingService.classifySolutions(solutions, totalSeconds);
  return result;
}
```

**Input Format**:
```typescript
{
  solutions: [
    {
      problemId: string;
      title: string;
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      code: string;          // Full user code
      language: string;      // 'javascript' | 'python' etc
      solved: boolean;       // Did user mark as solved?
    },
    // ... 3+ problem solutions
  ],
  totalSeconds: number;      // Time elapsed (900s = 15min)
}
```

### Execution Flow (OnboardingService)

#### 1. `classifySolutions()` (lines ~100-130)
```typescript
async classifySolutions(solutions, totalSeconds): Promise<ClassificationResult> {
  // Check if AI enabled
  const settings = await this.settingsService.getSettings();
  const aiEnabled = settings?.ollamaEnabled !== false;

  if (!aiEnabled || !this.groqApiKey) {
    return this.ruleBased(solutions, totalSeconds);  // Fallback
  }

  // Score each solution
  const problemScores = await Promise.all(
    solutions.map(sol => this.scoreSolution(sol))
  );

  // Calculate aggregate scores
  const aiScores = this.aggregateScores(problemScores);
  
  // Assign rank tier
  return this.classifyByRank(aiScores, problemScores);
}
```

#### 2. `scoreSolution()` (lines ~193-230)
**Per-problem AI evaluation**

```typescript
async scoreSolution(sol: SolutionInput): Promise<ProblemScore> {
  // Step 1: Validate not empty
  const isEmpty = !sol.code || 
                  sol.code.trim().length < 40 ||
                  STARTER_TOKENS.some(t => sol.code.includes(t));
  
  if (!sol.solved || isEmpty) {
    return this.zeroScore(sol, 'Problem not solved or no meaningful code');
  }

  // Step 2: Build prompt
  const prompt = this.buildPrompt(sol);
  
  // Step 3: Call Groq AI
  const raw = await this.callGroq(prompt);
  const parsed = this.extractJson(raw);

  // Step 4: Clamp scores (0-100)
  const exactitude = this.clamp(Number(parsed.exactitude) || 50);
  const complexity = this.clamp(Number(parsed.complexity) || 50);
  const style = this.clamp(Number(parsed.style) || 50);

  // Step 5: Composite score
  const composite = Math.round(
    exactitude * 0.40 +      // 40% correctness
    complexity * 0.35 +      // 35% efficiency
    style * 0.25             // 25% code quality
  );

  return {
    problemId: sol.problemId,
    title: sol.title,
    difficulty: sol.difficulty,
    exactitude,
    complexity,
    style,
    composite,
    notes: String(parsed.notes ?? ''),
  };
}
```

#### 3. `buildPrompt()` (lines ~244-260)
**Sends to Groq API (llama-3.1-8b-instant)**

```typescript
private buildPrompt(sol: SolutionInput): string {
  return `You are a senior software engineer evaluating a coding interview submission.

Problem: ${sol.title} (difficulty: ${sol.difficulty})
Language: ${sol.language}

Submitted solution:
\`\`\`${sol.language}
${sol.code}
\`\`\`

Score this solution on three axes, each from 0 to 100:
- exactitude: Is the algorithm logic correct? Would it pass all standard test cases? 
  (0 = completely wrong, 100 = perfectly correct)
- complexity: Is the time/space complexity optimal or near-optimal? 
  (0 = brute force, 100 = optimal)
- style: Is the code readable, clean, idiomatic for the language? 
  (0 = very messy, 100 = exemplary)

Output ONLY the JSON object with no additional text:
START_JSON_RESPONSE
{ "exactitude": X, "complexity": Y, "style": Z, "notes": "brief feedback" }
`;
}
```

#### 4. Rank Classification (lines ~150-185)
**Tier assignments in RANK_TIERS**

```typescript
const RANK_TIERS = [
  { min: 85, rank: 'DIAMOND',   xp: 500 },
  { min: 70, rank: 'PLATINUM',  xp: 380 },
  { min: 55, rank: 'GOLD',      xp: 250 },
  { min: 35, rank: 'SILVER',    xp: 120 },
  { min: 0,  rank: 'BRONZE',    xp: 0 },
];
```

Uses `totalScore` (average of problem composites) to select rank.

### Output Format (ClassificationResult)

```typescript
{
  rank: 'PLATINUM',                    // Rank tier
  label: 'Platinum',                   // Display label
  color: '#22d3ee',                    // Ring color
  gradient: ['#22d3ee', '#06b6d4'],    // Visual gradient
  xp: 380,                             // XP reward
  totalScore: 72,                      // Average composite score
  breakdown: [                         // Per-problem details
    {
      problemId: 'sc-001',
      title: 'Two Sum',
      difficulty: 'EASY',
      exactitude: 85,
      complexity: 70,
      style: 80,
      composite: 79,
      notes: 'Good solution, O(n) complexity'
    },
    // ... more problems
  ],
  aiScores: {
    exactitude: 80,   // Average across problems
    complexity: 72,
    style: 78,
  },
  message: 'Outstanding! Clean, efficient solutions delivered at pace.',
}
```

---

## 4. Problem Setup & Display

### Data Sources
**Frontend: SpeedChallengePage.jsx**

Gets problems from (in order of priority):
1. User's `currentUser.placementProblems` (if logged in)
2. `/api/onboarding-test` endpoint (fallback)
3. Static `SPEED_CHALLENGE_PROBLEMS` from `speedChallengeProblems.js`

### Problem Structure
```typescript
{
  id: 'sc-001',
  index: 1,
  difficulty: 'EASY',
  difficultyColor: '#22c55e',
  title: 'Two Sum',
  description: 'Given an array of integers...',
  examples: [
    { input: 'nums = [2,7,11,15], target = 9',
      output: '[0, 1]',
      explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
  ],
  constraints: ['2 ≤ nums.length ≤ 10⁴', ...],
  starterCode: {
    javascript: 'function twoSum(nums, target) {\n  // Your solution here\n}',
    python: 'def two_sum(nums, target):\n    pass',
  },
  testCases: [
    { input: 's = "()"', expected: 'true' },  // Simple test case format
  ],
  xpReward: 50,
}
```

### Display Components
- **SpeedProblemPanel.jsx**: Shows description, examples, constraints
- **PlacementResult.jsx**: Shows AI scores and rank ring visual

---

## 5. Compatibility Check (MISSING)

### Current State
❌ **No compatibility validation between submitted code and problem**

Currently the system:
1. ✅ Checks code is non-empty
2. ✅ Shows code in editor
3. ❌ **Does NOT validate** code matches problem
4. ❌ **Does NOT run** code against test cases
5. ✅ Sends code to AI for analysis (but AI doesn't run it either)

### Where to Add

#### Frontend Validation (Quick feedback)
**Location**: `handleSubmit()` in ChallengeArena component (line ~308)

```typescript
const handleSubmit = useCallback(() => {
  if (!codes[problem.id]?.trim()) {
    setFeedback('⚠️ Please write some code before submitting.');
    setSubmitState('error');
    return;
  }

  // ← ADD THIS:
  // 1. Check function signature
  const expectedFn = extractFunctionName(problem.title);
  if (!codes[problem.id].includes(`function ${expectedFn}`)) {
    setFeedback(`⚠️ Expected function name: ${expectedFn}`);
    setSubmitState('error');
    return;
  }

  // 2. Check not just starter code
  const starterLen = problem.starterCode.javascript.length;
  if (codes[problem.id].length <= starterLen + 20) {
    setFeedback('⚠️ Please write more meaningful code');
    setSubmitState('error');
    return;
  }

  setSubmitState('running');
  // ... rest of submit logic
}, [codes, problem]);
```

#### Backend Validation (Real execution)
**Suggested Endpoint**: `POST /api/code/validate`

```typescript
// Input
{
  code: string;
  language: string;
  problemId: string;
  testCases: { input: string; expected: string }[];
}

// Output
{
  passed: number;
  total: number;
  results: [
    {
      testCase: number;
      input: string;
      expected: string;
      actual: string;
      status: 'PASSED' | 'FAILED' | 'ERROR';
      runtime: number;  // ms
      error?: string;
    }
  ];
  success: boolean;  // all passed?
}
```

**Implementation**: 
- Use `vm2` library for sandboxed JavaScript execution
- Use `python-execute` for Python execution
- Timeout after 5 seconds
- Memory limit for runaway recursion

---

## Summary: Key Files & Functions

| Component | File | Key Function | Purpose |
|-----------|------|--------------|---------|
| **Frontend Entry** | SpeedChallengePage.jsx | handleFinish() | Orchestrates placing, AI call |
| **Code Submit** | SpeedChallengePage.jsx (line 308) | handleSubmit() | Mock validation (needs real one) |
| **Problem Display** | SpeedProblemPanel.jsx | - | Shows problem statement/examples |
| **Code Editor** | SpeedCodeEditor.jsx | - | Textarea + syntax highlighting |
| **Result Display** | PlacementResult.jsx | AIAnalysisSection() | Shows AI scores breakdown |
| **AI Analysis** | onboarding.service.ts | classifySolutions() | Main AI scoring logic |
| **AI Per-Problem** | onboarding.service.ts | scoreSolution() | Groq API call for 1 problem |
| **Rank Assignment** | onboarding.service.ts | classifyByRank() | Uses RANK_TIERS to assign rank |
| **Rule-based Fallback** | onboarding.service.ts | ruleBased() | Backup scoring if AI disabled |

---

## Missing/TODO

1. ❌ **Real Code Execution Engine**
   - File: `src/code-executor/` (currently empty)
   - Need: Sandboxed JavaScript/Python executor
   
2. ❌ **Code Validation Against Problem**
   - Location: `handleSubmit()` in SpeedChallengePage.jsx
   - Should validate function signature, basic structure
   
3. ❌ **Test Case Execution**
   - Need: Backend or client-side execution
   - Should: Run code on test cases before marking solved
   
4. ⚠️ **AI Receives Unvalidated Code**
   - Current: AI analyzes code quality but doesn't run it
   - Issue: Can't assess actual correctness vs stated correctness

---

## Notes for Further Development

- **Speed Challenge** is specifically for **new user placement testing**
- **NOT** a general practice arena (use `/challenges` for that)
- Rank is **permanent after assignment** (affects user's starting level)
- AI analysis is **async** - results shown while computing
- Fallback placement shown **immediately** for UX
- Session **auto-saves** every 3 seconds for resume capability
