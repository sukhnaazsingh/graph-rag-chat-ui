// src/lib/api.ts

import {TestCase, TestRun, TestSuite} from "@/lib/test-suite-types";

const API_BASE_URL = "http://localhost:8000" // Passe den Port ggf. an

// =============================================================================
// TYPES - Für einfache Integration mit Ihrem Backend
// =============================================================================

export interface ChatResponse {
    answer: string
    sessionId?: string
    sources?: Array<{
        documentId: string
        chunkId: string
        score: number
        content: string
    }>
}

export interface Document {
    id: string
    name: string
    size: number
    uploadedAt: string
    status: "processing" | "ready" | "error"
}

export interface Session {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    messageCount: number
}

export interface SessionHistory {
    id: string
    messages: Array<{
        role: "user" | "assistant"
        content: string
        timestamp: string
    }>
}

export interface ValidateResponse {
    passed: boolean
    similarity: number
    explanation: string
}

interface TestRunUpdatePayload {
    status?: string
    comment?: string
    isFavorite?: boolean // Backend erwartet snake_case
    favoriteOrder?: number
    passRate?: number
}

// =============================================================================
// EXISTING ENDPOINTS
// =============================================================================

export async function uploadDocument(file: File): Promise<Document> {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
    })

    if (!res.ok) throw new Error("Upload failed")
    return res.json()
}

export async function fetchDocuments(): Promise<Document[]> {
    const res = await fetch(`${API_BASE_URL}/documents`)
    if (!res.ok) throw new Error("Failed to fetch docs")
    return res.json()
}

export async function sendChatMessage(message: string, strategy: string, sessionId?: string): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            message,
            strategy,
            session_id: sessionId,
        }),
    })

    if (!res.ok) throw new Error("Chat failed")
    return res.json()
}

export async function fetchSessions(): Promise<Session[]> {
    const res = await fetch(`${API_BASE_URL}/sessions`)
    if (!res.ok) throw new Error("Failed to fetch sessions")
    return res.json()
}

export async function fetchSessionHistory(sessionId: string): Promise<SessionHistory> {
    const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`)
    if (!res.ok) throw new Error("Failed to load session history")
    return res.json()
}

export async function fetchTestSuites(): Promise<TestSuite[]> {
    const res = await fetch(`${API_BASE_URL}/test-suites`)
    if (!res.ok) throw new Error("Failed to fetch suites")
    return res.json()
}

export async function createTestSuiteApi(name: string, description: string): Promise<TestSuite> {
    const res = await fetch(`${API_BASE_URL}/test-suites`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name, description}),
    })
    if (!res.ok) throw new Error("Failed create suite")
    return res.json()
}

export async function updateTestSuiteApi(id: string, data: { name: string, description: string }): Promise<TestSuite> {
    const res = await fetch(`${API_BASE_URL}/test-suites/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data),
    })
    return res.json()
}

export async function deleteTestSuiteApi(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/test-suites/${id}`, {method: "DELETE"})
}

// === TEST CASE API ===

export async function createTestCaseApi(suiteId: string, question: string, expectedAnswer: string): Promise<TestCase> {
    // Dank CamelModel im Backend können wir expectedAnswer (camelCase) senden
    const res = await fetch(`${API_BASE_URL}/test-suites/${suiteId}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, expectedAnswer }),
    })
    if (!res.ok) throw new Error("Failed to add test case")
    return res.json()
}

export async function updateTestCaseApi(caseId: string, data: { question: string, expectedAnswer: string }): Promise<TestCase> {
    const res = await fetch(`${API_BASE_URL}/test-cases/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to update test case")
    return res.json()
}

export async function deleteTestCaseApi(caseId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/test-cases/${caseId}`, {
        method: "DELETE"
    })
    if (!res.ok) throw new Error("Failed to delete test case")
}

// === TEST RUN API ===

export async function fetchTestRuns(): Promise<TestRun[]> {
    const res = await fetch(`${API_BASE_URL}/test-runs`)
    return res.json()
}

export async function createTestRunApi(suiteId: string, strategy: string): Promise<TestRun> {
    const res = await fetch(`${API_BASE_URL}/test-runs`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({suite_id: suiteId, strategy}),
    })
    return res.json()
}

export async function deleteTestRunApi(runId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/test-runs/${runId}`, {
        method: "DELETE"
    })
    if (!res.ok) throw new Error("Failed to delete test run")
}

export async function updateTestRunStatusApi(runId: string, status: string, passRate?: number): Promise<TestRun> {
    const body: any = {status}
    if (passRate !== undefined) body.pass_rate = passRate

    const res = await fetch(`${API_BASE_URL}/test-runs/${runId}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
    })
    return res.json()
}

export async function updateTestRunResultApi(
    runId: string,
    testCaseId: string,
    actualAnswer: string,
    passed: boolean,
    explanation?: string
): Promise<void> {
    await fetch(`${API_BASE_URL}/test-runs/${runId}/results/${testCaseId}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            actual_answer: actualAnswer,
            passed,
            explanation
        }),
    })
}

export async function updateTestRunApi(runId: string, updates: Partial<TestRun>): Promise<TestRun> {
    // Mapping von Frontend (camelCase) zu Backend (snake_case)
    const payload: TestRunUpdatePayload = {}

    if (updates.status !== undefined) payload.status = updates.status
    if (updates.comment !== undefined) payload.comment = updates.comment
    if (updates.isFavorite !== undefined) payload.isFavorite = updates.isFavorite
    if (updates.favoriteOrder !== undefined) payload.favoriteOrder = updates.favoriteOrder
    if (updates.passRate !== undefined) payload.passRate = updates.passRate

    const res = await fetch(`${API_BASE_URL}/test-runs/${runId}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    })

    if (!res.ok) throw new Error("Failed to update run")
    return res.json()
}

// === TEST EXECUTION API ===

export async function runTestQuestion(question: string, strategy: string): Promise<{ answer: string }> {
    const res = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: question,
            strategy: strategy
        }),
    })

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || "Prediction failed")
    }

    return res.json()
}

/**
 * Sendet Erwartung und Ergebnis an das Backend zur Überprüfung.
 */
export async function validateAnswer(
    question: string,
    expectedAnswer: string,
    actualAnswer: string
): Promise<ValidateResponse> {
    const res = await fetch(`${API_BASE_URL}/validate`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            question,
            expected_answer: expectedAnswer,
            actual_answer: actualAnswer
        }),
    })

    if (!res.ok) {
        // Fallback: Wenn Validation Endpoint fehlschlägt, lokal "failen" lassen
        console.error("Validation endpoint failed")
        return {passed: false, similarity: 0, explanation: "Server Error during validation"}
    }

    return res.json()
}
