/**
 * DTOs pour la détection de plagiat
 */

export class DetectPlagiarismDto {
    submittedCode: string;
    referenceCode: string;
    userId: string;
    challengeId?: string;
    language?: 'javascript' | 'python' | 'typescript';
}

class SubmissionEntry {
    user_id: string;
    code: string;
}

export class BulkPlagiarismCheckDto {
    challenge_id: string;
    submissions: SubmissionEntry[];
}

export class PlagiarismThresholdDto {
    overallSimilarityThreshold: number; // 0-100
    technique?: 'all' | 'hash' | 'ast' | 'token' | 'ai';
}

class AIPattern {
    type: string;
    confidence: number;
    description: string;
}

class TECHNIQUE_DETAIL {
    technique: string;
    similarity: number;
}

class AI_TECHNIQUE_DETAIL extends TECHNIQUE_DETAIL {
    detectedPatterns: AIPattern[];
}

class TECHNIQUE_CONTAINER {
    hashMatch: TECHNIQUE_DETAIL;
    astComparison: TECHNIQUE_DETAIL;
    tokenSimilarity: TECHNIQUE_DETAIL;
    aiPatternDetection: AI_TECHNIQUE_DETAIL;
}

class PLAGIARISM_DATA {
    overallSimilarity: number;
    isSuspicious: boolean;
    recommendation: 'clear' | 'review' | 'suspicious';
    techniques: TECHNIQUE_CONTAINER;
    details: string[];
}

export class PlagiarismResponseDto {
    success: boolean;
    data: PLAGIARISM_DATA;
    timestamp: string;
}

class MatchTechniques {
    hash: number;
    ast: number;
    token: number;
    ai: number;
}

class MatchPair {
    user1: string;
    user2: string;
    overallSimilarity: number;
    recommendation: string;
    techniques: MatchTechniques;
}

export class BulkPlagiarismResultDto {
    success: boolean;
    challengeId: string;
    matchPairs: MatchPair[];
    timestamp: string;
}
