import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Plagiarism Detection Service for Speed Challenges
 * Implements multiple detection techniques:
 * 🔍 Hash-based detection (fast, basic)
 * 🔍 AST comparison (structural analysis)
 * 🔍 Token-based similarity (MOSS-like algorithm)
 * 🔍 AI-powered detection (pattern & logic similarity)
 */

export interface PlagiarismReport {
  overallSimilarity: number; // 0-100%
  isSuspicious: boolean;
  techniques: {
    hashMatch: HashDetectionResult;
    astComparison: ASTComparisonResult;
    tokenSimilarity: TokenSimilarityResult;
    aiPatternDetection: AIPatternResult;
  };
  details: string[];
  recommendation: 'clear' | 'review' | 'suspicious';
}

interface HashDetectionResult {
  technique: string;
  similarity: number;
  hashes: {
    fullCode: string;
    normalizedCode: string;
    trimmed: string;
  };
}

interface ASTComparisonResult {
  technique: string;
  similarity: number;
  structuralMatch: number;
  functionSignaturesMatch: boolean[];
  details: string;
}

interface TokenSimilarityResult {
  technique: string;
  similarity: number;
  commonTokens: number;
  totalTokens: number;
  jaccardIndex: number;
  details: string;
}

interface AIPatternResult {
  technique: string;
  similarity: number;
  detectedPatterns: Pattern[];
  suspiciousIndicators: string[];
  details: string;
}

interface Pattern {
  type:
    | 'variable_renaming'
    | 'logic_identical'
    | 'structure_identical'
    | 'whitespace_manipulation';
  confidence: number;
  description: string;
}

@Injectable()
export class PlagiarismDetectionService {
  private readonly HASH_THRESHOLD = 0.95; // Exact hash match
  private readonly AST_THRESHOLD = 0.85; // High structural similarity
  private readonly TOKEN_THRESHOLD = 0.75; // Moderate token similarity
  private readonly AI_THRESHOLD = 0.7; // Moderate AI confidence

  /**
   * Main detection method - analyzes code against a reference
   */
  async detectPlagiarism(
    submittedCode: string,
    referenceCode: string,
    userId: string,
  ): Promise<PlagiarismReport> {
    try {
      // Run all detection techniques in parallel
      const [hashResult, astResult, tokenResult, aiResult] = await Promise.all([
        this.detectByHash(submittedCode, referenceCode),
        this.detectByAST(submittedCode, referenceCode),
        this.detectByTokenSimilarity(submittedCode, referenceCode),
        this.detectByAIPatterns(submittedCode, referenceCode),
      ]);

      // Calculate weighted overall similarity
      const weights = {
        hash: 0.2,
        ast: 0.3,
        token: 0.25,
        ai: 0.25,
      };

      const overallSimilarity =
        hashResult.similarity * weights.hash +
        astResult.similarity * weights.ast +
        tokenResult.similarity * weights.token +
        aiResult.similarity * weights.ai;

      // Determine if suspicious
      const suspiciousCount = [
        hashResult.similarity > this.HASH_THRESHOLD,
        astResult.similarity > this.AST_THRESHOLD,
        tokenResult.similarity > this.TOKEN_THRESHOLD,
        aiResult.similarity > this.AI_THRESHOLD,
      ].filter(Boolean).length;

      const isSuspicious = overallSimilarity > 0.75 || suspiciousCount >= 2;

      // Generate details and recommendation
      const details = this.generateDetailedFindings(
        hashResult,
        astResult,
        tokenResult,
        aiResult,
      );

      return {
        overallSimilarity: Math.round(overallSimilarity * 100),
        isSuspicious,
        techniques: {
          hashMatch: hashResult,
          astComparison: astResult,
          tokenSimilarity: tokenResult,
          aiPatternDetection: aiResult,
        },
        details,
        recommendation: isSuspicious
          ? 'suspicious'
          : overallSimilarity > 0.6
            ? 'review'
            : 'clear',
      };
    } catch (error) {
      console.error('Plagiarism detection error:', error);
      return this.getSafeDefaultReport();
    }
  }

  /**
   * 🔍 Technique 1: Hash-based Detection (Fast, Basic)
   * Detects exact or near-exact code copies
   */
  private async detectByHash(
    submittedCode: string,
    referenceCode: string,
  ): Promise<HashDetectionResult> {
    const submitted = {
      full: this.hashCode(submittedCode),
      normalized: this.hashCode(this.normalizeCode(submittedCode)),
      trimmed: this.hashCode(submittedCode.replace(/\s/g, '')),
    };

    const reference = {
      full: this.hashCode(referenceCode),
      normalized: this.hashCode(this.normalizeCode(referenceCode)),
      trimmed: this.hashCode(referenceCode.replace(/\s/g, '')),
    };

    // Check for exact matches
    let similarity = 0;
    if (submitted.full === reference.full) {
      similarity = 1.0; // Exact match
    } else if (submitted.normalized === reference.normalized) {
      similarity = 0.95; // Normalized match
    } else if (submitted.trimmed === reference.trimmed) {
      similarity = 0.9; // Whitespace-only difference
    } else {
      similarity = 0.0; // No hash match
    }

    return {
      technique: 'SHA-256 Hash Comparison',
      similarity,
      hashes: {
        fullCode: submitted.full,
        normalizedCode: submitted.normalized,
        trimmed: submitted.trimmed,
      },
    };
  }

  /**
   * 🔍 Technique 2: AST Comparison (Structural Analysis)
   * Compares abstract syntax trees to detect structural similarity
   */
  private async detectByAST(
    submittedCode: string,
    referenceCode: string,
  ): Promise<ASTComparisonResult> {
    let submittedAST: any = null;
    let referenceAST: any = null;

    try {
      submittedAST = this.parseCodeToAST(submittedCode);
      referenceAST = this.parseCodeToAST(referenceCode);
    } catch (e) {
      return {
        technique: 'AST (Abstract Syntax Tree) Analysis',
        similarity: 0,
        structuralMatch: 0,
        functionSignaturesMatch: [],
        details: 'Failed to parse code to AST',
      };
    }

    const submittedStructure = this.extractStructure(submittedAST);
    const referenceStructure = this.extractStructure(referenceAST);

    const similarity = this.compareFunctionSignatures(
      submittedStructure,
      referenceStructure,
    );

    return {
      technique: 'AST (Abstract Syntax Tree) Analysis',
      similarity,
      structuralMatch: similarity,
      functionSignaturesMatch: this.matchFunctionSignatures(
        submittedStructure,
        referenceStructure,
      ),
      details: `Structural similarity: ${(similarity * 100).toFixed(2)}%`,
    };
  }

  /**
   * 🔍 Technique 3: Token-based Similarity (MOSS-like)
   * Uses document fingerprinting and winnowing
   */
  private async detectByTokenSimilarity(
    submittedCode: string,
    referenceCode: string,
  ): Promise<TokenSimilarityResult> {
    const submittedTokens = this.tokenize(submittedCode);
    const referenceTokens = this.tokenize(referenceCode);

    // Calculate Jaccard similarity
    const commonTokens = this.countCommonTokens(
      submittedTokens,
      referenceTokens,
    );
    const totalTokens = new Set([...submittedTokens, ...referenceTokens]).size;

    const jaccardIndex = totalTokens > 0 ? commonTokens / totalTokens : 0;

    // Calculate cosine similarity for additional metric
    const cosineSimilarity = this.calculateCosineSimilarity(
      submittedTokens,
      referenceTokens,
    );

    // Average the metrics
    const similarity = (jaccardIndex + cosineSimilarity) / 2;

    return {
      technique: 'Token-based Similarity (MOSS-like winnowing)',
      similarity: Math.min(similarity, 1.0),
      commonTokens,
      totalTokens,
      jaccardIndex,
      details: `Jaccard: ${(jaccardIndex * 100).toFixed(2)}% | Cosine: ${(cosineSimilarity * 100).toFixed(2)}%`,
    };
  }

  /**
   * 🔍 Technique 4: AI-Powered Pattern Detection
   * Detects variable renaming, identical logic, structural cloning
   */
  private async detectByAIPatterns(
    submittedCode: string,
    referenceCode: string,
  ): Promise<AIPatternResult> {
    const patterns: Pattern[] = [];
    const suspiciousIndicators: string[] = [];

    // Try to parse ASTs for deeper analysis
    let submittedAST: any = null;
    let referenceAST: any = null;

    try {
      submittedAST = this.parseCodeToAST(submittedCode);
      referenceAST = this.parseCodeToAST(referenceCode);
    } catch (e) {
      return {
        technique: 'AI Pattern Detection',
        similarity: 0,
        detectedPatterns: [],
        suspiciousIndicators: ['Failed to parse code for pattern analysis'],
        details: 'AST parsing failed for pattern analysis',
      };
    }

    // 1. Detect variable renaming (logic identical with different var names)
    const variableRenamingScore = this.detectVariableRenaming(
      submittedAST,
      referenceAST,
    );
    if (variableRenamingScore > 0.7) {
      patterns.push({
        type: 'variable_renaming',
        confidence: variableRenamingScore,
        description: 'Code structure identical but variable names different',
      });
      suspiciousIndicators.push(
        `Variable renaming detected (${(variableRenamingScore * 100).toFixed(2)}%)`,
      );
    }

    // 2. Detect identical logic flow
    const logicIdenticalScore = this.detectLogicIdentical(
      submittedCode,
      referenceCode,
    );
    if (logicIdenticalScore > 0.8) {
      patterns.push({
        type: 'logic_identical',
        confidence: logicIdenticalScore,
        description: 'Logic flow and operations are identical',
      });
      suspiciousIndicators.push(
        `Identical logic detected (${(logicIdenticalScore * 100).toFixed(2)}%)`,
      );
    }

    // 3. Detect structural duplication
    const structureScore = this.detectStructureIdentical(
      submittedCode,
      referenceCode,
    );
    if (structureScore > 0.85) {
      patterns.push({
        type: 'structure_identical',
        confidence: structureScore,
        description: 'Code structure and flow are nearly identical',
      });
      suspiciousIndicators.push(
        `Structure duplication (${(structureScore * 100).toFixed(2)}%)`,
      );
    }

    // 4. Detect whitespace manipulation
    const whitespaceScore = this.detectWhitespaceManipulation(
      submittedCode,
      referenceCode,
    );
    if (whitespaceScore > 0.95) {
      patterns.push({
        type: 'whitespace_manipulation',
        confidence: whitespaceScore,
        description: 'Code is identical except for whitespace/formatting',
      });
      suspiciousIndicators.push('Suspicious whitespace manipulation');
    }

    // Calculate overall pattern-based similarity
    const avgConfidence =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
        : 0;

    return {
      technique: 'AI-Powered Pattern Detection',
      similarity: avgConfidence,
      detectedPatterns: patterns,
      suspiciousIndicators,
      details: `${patterns.length} suspicious patterns detected`,
    };
  }

  // ==================== Helper Methods ====================

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private normalizeCode(code: string): string {
    return code
      .replace(/\s+/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .trim();
  }

  private parseCodeToAST(code: string) {
    return parser.parse(code, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: ['jsx', 'typescript'],
    });
  }

  private extractStructure(ast: any) {
    const structure = {
      functionCount: 0,
      functionNames: [] as string[],
      parameterCounts: [] as number[],
      loopStructures: [] as string[],
      conditionalStructures: [] as string[],
    };

    traverse(ast, {
      FunctionDeclaration(path) {
        structure.functionCount++;
        structure.functionNames.push(path.node.id?.name || 'anonymous');
        structure.parameterCounts.push(path.node.params.length);
      },
      ForStatement() {
        structure.loopStructures.push('for');
      },
      WhileStatement() {
        structure.loopStructures.push('while');
      },
      IfStatement() {
        structure.conditionalStructures.push('if');
      },
    });

    return structure;
  }

  private compareFunctionSignatures(submitted: any, reference: any): number {
    let matchScore = 0;
    let totalComparison = 0;

    // Compare function count
    const funcCountMatch =
      1 -
      Math.abs(submitted.functionCount - reference.functionCount) /
        Math.max(submitted.functionCount, reference.functionCount, 1);
    matchScore += funcCountMatch;
    totalComparison++;

    // Compare parameter counts
    const submittedParams = submitted.parameterCounts;
    const referenceParams = reference.parameterCounts;
    if (submittedParams.length === referenceParams.length) {
      const paramMatch = submittedParams.every(
        (p, i) => p === referenceParams[i],
      );
      matchScore += paramMatch ? 1 : 0.5;
    }
    totalComparison++;

    // Compare loop structures
    const loopMatch =
      new Set(submitted.loopStructures).size ===
      new Set(reference.loopStructures).size
        ? 0.8
        : 0.3;
    matchScore += loopMatch;
    totalComparison++;

    return matchScore / totalComparison;
  }

  private matchFunctionSignatures(submitted: any, reference: any): boolean[] {
    const results: boolean[] = [];
    for (
      let i = 0;
      i <
      Math.min(submitted.functionNames.length, reference.functionNames.length);
      i++
    ) {
      results.push(
        submitted.parameterCounts[i] === reference.parameterCounts[i],
      );
    }
    return results;
  }

  private tokenize(code: string): string[] {
    // Remove comments
    const cleaned = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    // Tokenize by common delimiters
    const tokens = cleaned
      .split(/[\s\(\)\{\}\[\];:,=+\-*/%<>!&|^~?:]/)
      .filter((t) => t.length > 0);

    return tokens;
  }

  private countCommonTokens(tokens1: string[], tokens2: string[]): number {
    const set2 = new Set(tokens2);
    return tokens1.filter((t) => set2.has(t)).length;
  }

  private calculateCosineSimilarity(
    tokens1: string[],
    tokens2: string[],
  ): number {
    const map1 = this.createTokenMap(tokens1);
    const map2 = this.createTokenMap(tokens2);

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const token of new Set([...tokens1, ...tokens2])) {
      const count1 = map1.get(token) || 0;
      const count2 = map2.get(token) || 0;

      dotProduct += count1 * count2;
      magnitude1 += count1 * count1;
      magnitude2 += count2 * count2;
    }

    const denom = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return denom === 0 ? 0 : dotProduct / denom;
  }

  private createTokenMap(tokens: string[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const token of tokens) {
      map.set(token, (map.get(token) || 0) + 1);
    }
    return map;
  }

  private detectVariableRenaming(ast1: any, ast2: any): number {
    // Extract variable patterns from both ASTs
    const vars1 = this.extractVariablePatterns(ast1);
    const vars2 = this.extractVariablePatterns(ast2);

    // If variable counts match but names don't, it's suspicious
    if (vars1.length === vars2.length && vars1.length > 0) {
      const namesDifferent = vars1.every((v, i) => v !== vars2[i]);
      if (namesDifferent) {
        return 0.85; // High confidence in variable renaming
      }
    }

    return 0;
  }

  private extractVariablePatterns(ast: any): string[] {
    const variables: string[] = [];
    traverse(ast, {
      VariableDeclarator(path: any) {
        if ('id' in path.node && path.node.id && 'name' in path.node.id) {
          variables.push(path.node.id.name);
        }
      },
    });
    return variables;
  }

  private detectLogicIdentical(code1: string, code2: string): number {
    // Remove all non-essential parts (variables, whitespace, comments)
    const logic1 = this.extractLogicFlow(code1);
    const logic2 = this.extractLogicFlow(code2);

    if (logic1 === logic2) {
      return 0.95;
    }

    // Calculate similarity of logic patterns
    const similarity = this.stringSimilarity(logic1, logic2);
    return similarity > 0.8 ? similarity : 0;
  }

  private extractLogicFlow(code: string): string {
    return code
      .replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, 'VAR') // Replace all identifiers
      .replace(/\d+/g, 'NUM') // Replace all numbers
      .replace(/(['"`])[\s\S]*?\1/g, 'STR') // Replace strings
      .replace(/\s+/g, ' ')
      .trim();
  }

  private detectStructureIdentical(code1: string, code2: string): number {
    const structure1 = this.getCodeStructure(code1);
    const structure2 = this.getCodeStructure(code2);
    return this.stringSimilarity(structure1, structure2);
  }

  private getCodeStructure(code: string): string {
    // Create a structure signature of the code
    return code
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('function')) return 'F';
        if (
          trimmed.startsWith('if') ||
          trimmed.startsWith('for') ||
          trimmed.startsWith('while')
        )
          return 'C';
        if (trimmed.startsWith('return')) return 'R';
        return 'S';
      })
      .filter((c) => c)
      .join('');
  }

  private detectWhitespaceManipulation(code1: string, code2: string): number {
    const clean1 = code1.replace(/\s/g, '');
    const clean2 = code2.replace(/\s/g, '');
    return clean1 === clean2 ? 0.99 : 0;
  }

  private stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const maxLength = Math.max(str1.length, str2.length);
    const distance = this.levenshteinDistance(str1, str2);

    return 1 - distance / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private generateDetailedFindings(
    hashResult: HashDetectionResult,
    astResult: ASTComparisonResult,
    tokenResult: TokenSimilarityResult,
    aiResult: AIPatternResult,
  ): string[] {
    const findings: string[] = [];

    if (hashResult.similarity > 0.9) {
      findings.push(
        `⚠️ Hash Match: ${(hashResult.similarity * 100).toFixed(2)}% - Possible exact copy`,
      );
    }

    if (astResult.similarity > 0.85) {
      findings.push(
        `⚠️ AST Analysis: ${(astResult.similarity * 100).toFixed(2)}% - Similar code structure`,
      );
    }

    if (tokenResult.similarity > 0.75) {
      findings.push(
        `⚠️ Token Similarity: ${(tokenResult.similarity * 100).toFixed(2)}% - Common tokens detected`,
      );
    }

    if (aiResult.detectedPatterns.length > 0) {
      findings.push(
        `🤖 AI Patterns: ${aiResult.detectedPatterns.map((p) => p.type).join(', ')}`,
      );
    }

    return findings.length > 0
      ? findings
      : ['✅ No plagiarism indicators detected'];
  }

  private getSafeDefaultReport(): PlagiarismReport {
    return {
      overallSimilarity: 0,
      isSuspicious: false,
      techniques: {
        hashMatch: {
          technique: 'Hash',
          similarity: 0,
          hashes: { fullCode: '', normalizedCode: '', trimmed: '' },
        },
        astComparison: {
          technique: 'AST',
          similarity: 0,
          structuralMatch: 0,
          functionSignaturesMatch: [],
          details: 'Error in processing',
        },
        tokenSimilarity: {
          technique: 'Token',
          similarity: 0,
          commonTokens: 0,
          totalTokens: 0,
          jaccardIndex: 0,
          details: 'Error in processing',
        },
        aiPatternDetection: {
          technique: 'AI Patterns',
          similarity: 0,
          detectedPatterns: [],
          suspiciousIndicators: [],
          details: 'Error in processing',
        },
      },
      details: ['Unable to analyze code for plagiarism'],
      recommendation: 'review',
    };
  }
}
