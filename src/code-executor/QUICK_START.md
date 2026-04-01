# ⚡ Quick Start Guide - Plagiarism Detection

## 🎯 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd AlgoArenaBackEnd
npm install @babel/parser @babel/traverse
```

### Step 2: Module Ready
The plagiarism service is already integrated in `code-executor.module.ts`. No setup needed!

### Step 3: Use the Service
```typescript
import { PlagiarismDetectionService } from './plagiarism-detection.service';

constructor(private plagiarism: PlagiarismDetectionService) {}

// Detect plagiarism between two code submissions
const result = await this.plagiarism.detectPlagiarism(
    submittedCode,
    referenceCode,
    userId
);

console.log(result.recommendation); // 'suspicious' | 'review' | 'clear'
console.log(result.overallSimilarity); // 0-100
```

---

## 🚀 Common Use Cases

### 1. Check Single Submission
```typescript
async checkSubmission(userId: string, code: string, reference: string) {
    const result = await this.plagiarism.detectPlagiarism(code, reference, userId);
    
    if (result.isSuspicious) {
        console.warn(`⚠️ User ${userId} flagged for plagiarism!`);
        // Notify admin, flag for review, etc.
    }
    
    return result;
}
```

### 2. Bulk Check Challenge (All submissions)
```typescript
async analyzeChallengeForPlagiarism(
    challengeId: string,
    submissions: Array<{ userId: string; code: string }>
) {
    const suspiciousPairs = [];
    
    // Compare all pairs
    for (let i = 0; i < submissions.length; i++) {
        for (let j = i + 1; j < submissions.length; j++) {
            const result = await this.plagiarism.detectPlagiarism(
                submissions[i].code,
                submissions[j].code,
                submissions[i].userId
            );
            
            if (result.isSuspicious) {
                suspiciousPairs.push({
                    user1: submissions[i].userId,
                    user2: submissions[j].userId,
                    similarity: result.overallSimilarity,
                });
            }
        }
    }
    
    return suspiciousPairs;
}
```

### 3. API Endpoint
```bash
curl -X POST http://localhost:3000/api/plagiarism/detect \
  -H "Content-Type: application/json" \
  -d '{
    "submittedCode": "function solution(n) { return n * 2; }",
    "referenceCode": "function solve(x) { return x * 2; }",
    "userId": "user123",
    "language": "javascript"
  }'
```

---

## 📊 Understanding the Results

```typescript
{
    "overallSimilarity": 78,          // 0-100% score
    "isSuspicious": true,              // true if likely plagiarism
    "recommendation": "suspicious",    // 'clear' | 'review' | 'suspicious'
    
    "techniques": {
        "hashMatch": {
            "technique": "SHA-256 Hash Comparison",
            "similarity": 0              // 0-100 within this technique
        },
        "astComparison": {
            "technique": "AST Analysis",
            "similarity": 92
        },
        "tokenSimilarity": {
            "technique": "Token-based Similarity",
            "similarity": 85
        },
        "aiPatternDetection": {
            "technique": "AI-Powered Pattern Detection",
            "similarity": 85,
            "detectedPatterns": [
                {
                    "type": "variable_renaming",
                    "confidence": 0.85,
                    "description": "..."
                }
            ]
        }
    },
    
    "details": [         // Human-readable findings
        "⚠️ AST Analysis: 92% - Similar code structure",
        "⚠️ Token Similarity: 85% - Common tokens detected",
        "🤖 AI Patterns: variable_renaming"
    ]
}
```

### Interpreting the Scores

| Overall % | Recommendation | Action |
|-----------|----------------|--------|
| 0-40% | ✅ Clear | Accept |
| 40-60% | ✅ Clear | Accept |
| 60-75% | 📋 Review | Flag for manual review |
| 75-90% | ⚠️ Suspicious | Likely plagiarism |
| 90-100% | ⚠️ Suspicious | Definite plagiarism |

---

## 🔧 Configuration

### Adjust Thresholds (in service)
```typescript
private readonly HASH_THRESHOLD = 0.95;   // Exact match
private readonly AST_THRESHOLD = 0.85;    // Structure similarity
private readonly TOKEN_THRESHOLD = 0.75;  // Algorithm similarity
private readonly AI_THRESHOLD = 0.70;     // Pattern confidence
```

### Adjust Weights
```typescript
const weights = {
    hash: 0.20,   // 20%
    ast: 0.30,    // 30% (highest for code)
    token: 0.25,  // 25%
    ai: 0.25,     // 25%
};
```

---

## 🧪 Quick Test

```typescript
// Test 1: Exact copy should be flagged
const exact = await plagiarism.detectPlagiarism(
    "function solution(n) { return n * 2; }",
    "function solution(n) { return n * 2; }",
    "user1"
);
console.assert(exact.isSuspicious === true, "Exact copy should be suspicious");

// Test 2: Different solutions should pass
const different = await plagiarism.detectPlagiarism(
    "function solution(n) { return n * (n+1) / 2; }",
    "function solution(n) { let s = 0; for(let i=0; i<n; i++) s += i; return s; }",
    "user2"
);
console.assert(different.isSuspicious === false, "Different solutions should be clear");
```

---

## 📡 API Response Examples

### Clear (No Plagiarism)
```json
{
    "success": true,
    "data": {
        "overallSimilarity": 25,
        "isSuspicious": false,
        "recommendation": "clear",
        "details": ["✅ No plagiarism indicators detected"]
    },
    "timestamp": "2026-03-26T10:30:00Z"
}
```

### Review (Manual Check)
```json
{
    "success": true,
    "data": {
        "overallSimilarity": 68,
        "isSuspicious": false,
        "recommendation": "review",
        "details": [
            "⚠️ AST Analysis: 72% - Similar code structure",
            "⚠️ Token Similarity: 65% - Common patterns"
        ]
    },
    "timestamp": "2026-03-26T10:30:00Z"
}
```

### Suspicious (Likely Plagiarism)
```json
{
    "success": true,
    "data": {
        "overallSimilarity": 82,
        "isSuspicious": true,
        "recommendation": "suspicious",
        "techniques": {
            "aiPatternDetection": {
                "detectedPatterns": [
                    {
                        "type": "variable_renaming",
                        "confidence": 0.85,
                        "description": "Code structure identical but variable names different"
                    }
                ]
            }
        },
        "details": [
            "⚠️ AST Analysis: 95% - Similar code structure",
            "⚠️ Token Similarity: 88% - Common tokens detected",
            "🤖 AI Patterns: variable_renaming"
        ]
    },
    "timestamp": "2026-03-26T10:30:00Z"
}
```

---

## 📈 Performance Tips

### Single Detection
```typescript
// Fast: ~350ms per comparison
const result = await plagiarism.detectPlagiarism(code1, code2, userId);
```

### Bulk Detection (30+ codes)
```typescript
// Run in parallel batches (max 5 concurrent)
const batches = [];
for (let i = 0; i < submissions.length; i += 5) {
    batches.push(
        Promise.all(
            submissions.slice(i, i+5).map(sub =>
                plagiarism.detectPlagiarism(...)
            )
        )
    );
}
await Promise.all(batches);
```

---

## 🔍 Troubleshooting

### "Module not found" Error
```bash
npm install @babel/parser @babel/traverse
npm install --save-dev @types/babel__parser @types/babel__traverse
```

### Service not injecting
Make sure `code-executor.module.ts` has:
```typescript
import { PlagiarismDetectionService } from './plagiarism-detection.service';

@Module({
    providers: [PlagiarismDetectionService],
    exports: [PlagiarismDetectionService],
})
```

### Always gets "clear"
- Check thresholds match your expected behavior
- Review `details` array for what each technique found
- Check test cases in `plagiarism-detection.service.spec.ts`

---

## 📚 Next Steps

1. **Integrate into Speed Challenge**
   - Check submission against previous ones
   - Flag suspicious submissions

2. **Create Admin Dashboard**
   - Show plagiarism reports
   - Allow manual review/override

3. **Add Audit Logging**
   - Log all detection results
   - Track appeals and resolutions

4. **Run Tests**
   ```bash
   npm test -- plagiarism-detection.service.spec.ts
   ```

---

## 🎓 Learning Resources

- **See detailed examples**: [PLAGIARISM_DETECTION.md](./PLAGIARISM_DETECTION.md)
- **Visual guides**: [PLAGIARISM_VISUAL_GUIDE.md](./PLAGIARISM_VISUAL_GUIDE.md)
- **Integration patterns**: [integration.example.ts](./integration.example.ts)
- **Unit tests**: [plagiarism-detection.service.spec.ts](./plagiarism-detection.service.spec.ts)

---

**That's it! You're ready to detect plagiarism! 🚀**

For more details, check the full documentation files.
