// Test Suite Types für die Validierung von LLM-Antworten

export interface TestCase {
    id: string
    question: string
    expectedAnswer: string
    createdAt: string
}

export interface TestSuite {
    id: string
    name: string
    description: string
    testCases: TestCase[]
    createdAt: string
    updatedAt: string
}

export interface TestCaseResult {
    testCaseId: string
    question: string
    expectedAnswer: string
    actualAnswer: string
    passed: boolean | null // null = nicht validiert, true = bestanden, false = nicht bestanden
    similarity?: number // Optional: Ähnlichkeitsscore
    explanation?: string
}

export interface TestRun {
    id: string
    suiteId: string
    suiteName: string
    strategy: string
    results: TestCaseResult[]
    status: "pending" | "running" | "completed" | "failed"
    comment: string
    isFavorite: boolean
    favoriteOrder: number // Für Sortierung der Favoriten
    startedAt: string
    completedAt?: string
    passRate: number // Prozentsatz der bestandenen Tests
}
