"use client"

import * as React from "react"
import {Button} from "@/components/ui/button"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import {ScrollArea} from "@/components/ui/scroll-area"
import {Badge} from "@/components/ui/badge"
import {Progress} from "@/components/ui/progress"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {
    ArrowLeft,
    CheckCircle2,
    CircleDashed,
    Info,
    Loader2,
    MessageSquare,
    Play,
    RefreshCw,
    Star,
    XCircle,
} from "lucide-react"
import type {TestCaseResult, TestRun, TestSuite} from "@/lib/test-suite-types"
import {createTestRunApi, runTestQuestion, updateTestRunApi, updateTestRunResultApi, validateAnswer} from "@/lib/api"
import {cn} from "@/lib/utils"

interface TestRunPanelProps {
    suite: TestSuite
    existingRun?: TestRun | null
    onRunUpdated: (run: TestRun) => void
    onBack: () => void
    onHistoryChanged?: () => void
}

// Helper für Concurrency
async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<void>
) {
    const queue = [...items].map((item, index) => ({item, index}));
    const activeWorkers = Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
        while (queue.length > 0) {
            const {item, index} = queue.shift()!;
            await fn(item, index);
        }
    });
    await Promise.all(activeWorkers);
}

export function TestRunPanel({suite, existingRun, onRunUpdated, onBack, onHistoryChanged}: TestRunPanelProps) {
    const [run, setRun] = React.useState<TestRun | null>(existingRun || null)
    const [isRunning, setIsRunning] = React.useState(false)

    // WICHTIG: Set für parallele Lade-Indikatoren
    const [activeTestIndices, setActiveTestIndices] = React.useState<Set<number>>(new Set())

    const [strategy, setStrategy] = React.useState(existingRun?.strategy || "rule-based-strategy")
    const [comment, setComment] = React.useState(existingRun?.comment || "")
    const [showComment, setShowComment] = React.useState(false)

    const results = run?.results || []
    const testCaseCount = run ? results.length : suite.testCases.length
    const completedCount = results.filter((r) => r.passed !== null).length
    const passedCount = results.filter((r) => r.passed === true).length
    const failedCount = results.filter((r) => r.passed === false).length
    const progress = testCaseCount > 0 ? (completedCount / testCaseCount) * 100 : 0

    React.useEffect(() => {
        if (existingRun) {
            setRun(existingRun)
            setComment(existingRun.comment || "")
        }
    }, [existingRun])

    const startTests = async () => {
        const newRun = await createTestRunApi(suite.id, strategy)
        setRun(newRun)
        onRunUpdated(newRun)
        onHistoryChanged?.()
        await executeTestsForRun(newRun)
    }

    const reRunTests = async () => {
        const newRun = await createTestRunApi(suite.id, strategy)
        setRun(newRun)
        onRunUpdated(newRun)
        onHistoryChanged?.()
        await executeTestsForRun(newRun)
    }

    const executeTestsForRun = async (targetRun: TestRun) => {
        setIsRunning(true)
        await updateTestRunApi(targetRun.id, {status: "running"})

        let currentResults = [...targetRun.results]
        let passedCount = 0

        // Funktion, die EINEN Test ausführt (wird parallel aufgerufen)
        const runSingleTest = async (result: TestCaseResult, index: number) => {

            // 1. Index zum aktiven Set hinzufügen (Thread-Safe)
            setActiveTestIndices(prev => {
                const newSet = new Set(prev)
                newSet.add(index)
                return newSet
            })

            try {
                // A. Prediction
                const response = await runTestQuestion(result.question, strategy)

                // B. Validation
                const validation = await validateAnswer(result.question, result.expectedAnswer, response.answer)

                // C. API Update
                await updateTestRunResultApi(
                    targetRun.id,
                    result.testCaseId,
                    response.answer,
                    validation.passed,
                    validation.explanation
                )

                // D. Lokales Update
                currentResults[index] = {
                    ...result,
                    actualAnswer: response.answer,
                    passed: validation.passed,
                    explanation: validation.explanation
                }

                setRun(prev => prev ? {...prev, results: [...currentResults]} : null)

                if (validation.passed) passedCount++

            } catch (error) {
                console.error(`Test ${index} failed:`, error)
                await updateTestRunResultApi(targetRun.id, result.testCaseId, "Error", false, String(error))

                currentResults[index] = {...result, actualAnswer: "Error", passed: false, explanation: String(error)}
                setRun(prev => prev ? {...prev, results: [...currentResults]} : null)

            } finally {
                // 2. Index aus dem aktiven Set entfernen (Thread-Safe)
                setActiveTestIndices(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(index)
                    return newSet
                })
            }
        }

        // Parallel starten (3 gleichzeitig)
        await runWithConcurrency(targetRun.results, 3, runSingleTest)

        setIsRunning(false)

        const finalPassRate = Math.round((passedCount / targetRun.results.length) * 100)
        const completedRun = await updateTestRunApi(targetRun.id, {
            status: "completed",
            passRate: finalPassRate
        })

        setRun(completedRun)
        onRunUpdated(completedRun)
        onHistoryChanged?.()
    }

    const handleToggleFavorite = async () => {
        if (!run) return
        const newFavoriteStatus = !run.isFavorite
        const optimisticRun = {...run, isFavorite: newFavoriteStatus}
        setRun(optimisticRun)
        onRunUpdated(optimisticRun)
        try {
            await updateTestRunApi(run.id, {isFavorite: newFavoriteStatus})
            onHistoryChanged?.()
        } catch (error) {
            setRun(run)
        }
    }

    const handleSaveComment = async () => {
        if (!run) return
        try {
            const updatedRun = await updateTestRunApi(run.id, {comment: comment})
            setRun(updatedRun)
            onRunUpdated(updatedRun)
            onHistoryChanged?.()
            setShowComment(false)
        } catch (error) {
            console.error("Failed to save comment", error)
        }
    }

    const handleManualValidation = async (testCaseId: string, passed: boolean) => {
        if (!run) return
        const resultIndex = run.results.findIndex((r) => r.testCaseId === testCaseId)
        if (resultIndex === -1) return

        const result = run.results[resultIndex]
        const newResults = [...run.results]
        newResults[resultIndex] = {...result, passed}

        const pCount = newResults.filter(r => r.passed === true).length
        const pRate = Math.round((pCount / newResults.length) * 100)

        const optimisticRun = {...run, results: newResults, passRate: pRate}
        setRun(optimisticRun)

        try {
            await updateTestRunResultApi(run.id, testCaseId, result.actualAnswer, passed)
            await updateTestRunApi(run.id, {passRate: pRate})
            onRunUpdated(optimisticRun)
            onHistoryChanged?.()
        } catch (error) {
            console.error("Failed to update validation", error)
        }
    }

    const getStatusIcon = (result: TestCaseResult, index: number) => {
        // Prüfen ob dieser Index im aktiven Set ist
        if (activeTestIndices.has(index)) {
            return <Loader2 className="h-5 w-5 animate-spin text-blue-500"/>
        }

        // Warteschlange Visualisierung (optional)
        if (isRunning && result.passed === null && !activeTestIndices.has(index)) {
            return <CircleDashed className="h-5 w-5 text-muted-foreground opacity-30"/>
        }

        if (result.passed === true) {
            return <CheckCircle2 className="h-5 w-5 text-green-500"/>
        }
        if (result.passed === false) {
            return <XCircle className="h-5 w-5 text-red-500"/>
        }
        return <CircleDashed className="h-5 w-5 text-muted-foreground"/>
    }

    const displayItems = run
        ? run.results
        : suite.testCases.map((tc) => ({
            testCaseId: tc.id,
            question: tc.question,
            expectedAnswer: tc.expectedAnswer,
            actualAnswer: "",
            passed: null,
            explanation: "",
        }))

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-background">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-1"/>
                        Zurück
                    </Button>
                    <div className="border-l pl-3">
                        <h2 className="font-semibold">Test Run: {suite.name}</h2>
                        {run ? (
                            <p className="text-xs text-muted-foreground">
                                Gestartet: {new Date(run.startedAt).toLocaleString("de-CH")}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">{suite.testCases.length} Test Cases bereit</p>
                        )}
                    </div>
                </div>
                {run && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant={run.isFavorite ? "default" : "outline"}
                            size="sm"
                            onClick={handleToggleFavorite}
                            className={cn(run.isFavorite && "bg-yellow-500 hover:bg-yellow-600 text-white")}
                        >
                            <Star className={cn("h-4 w-4", run.isFavorite && "fill-current")}/>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowComment(!showComment)}>
                            <MessageSquare className="h-4 w-4"/>
                        </Button>
                    </div>
                )}
            </div>

            {/* Comment Section */}
            {showComment && run && (
                <div className="p-4 border-b bg-muted/30">
                    <Label className="text-sm font-medium mb-2 block">Kommentar zu diesem Run</Label>
                    <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Notizen zu diesem Test Run hinzufügen..."
                        rows={3}
                        className="mb-2"
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowComment(false)}>
                            Abbrechen
                        </Button>
                        <Button size="sm" onClick={handleSaveComment}>
                            Speichern
                        </Button>
                    </div>
                </div>
            )}

            {/* Progress & Controls */}
            <div className="p-4 border-b space-y-4 bg-background">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Fortschritt</span>
                            <span className="text-sm text-muted-foreground">
                {completedCount} / {testCaseCount} Tests
              </span>
                        </div>
                        <Progress value={progress} className="h-2"/>
                    </div>
                    {run && (
                        <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                                {passedCount} bestanden
                            </Badge>
                            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                                {failedCount} fehlgeschlagen
                            </Badge>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <Select value={strategy} onValueChange={setStrategy} disabled={isRunning}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="rule-based-strategy">Rule Based</SelectItem>
                            <SelectItem value="llm-strategy">LLM Based</SelectItem>
                        </SelectContent>
                    </Select>
                    {!run ? (
                        <Button onClick={startTests} disabled={isRunning || suite.testCases.length === 0}>
                            <Play className="h-4 w-4 mr-2"/>
                            Tests starten
                        </Button>
                    ) : run.status === "completed" ? (
                        <Button onClick={reRunTests} disabled={isRunning}>
                            <RefreshCw className="h-4 w-4 mr-2"/>
                            Erneut ausführen
                        </Button>
                    ) : isRunning ? (
                        <Button disabled>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                            Läuft...
                        </Button>
                    ) : (
                        <Button onClick={() => run && executeTestsForRun(run)} disabled={isRunning}>
                            <Play className="h-4 w-4 mr-2"/>
                            Fortsetzen
                        </Button>
                    )}
                </div>
            </div>

            {/* Results List */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {displayItems.map((result, index) => (
                        <div
                            key={result.testCaseId}
                            className={cn(
                                "border rounded-lg p-4 transition-colors",
                                result.passed === true && "border-green-500/30 bg-green-500/5",
                                result.passed === false && "border-red-500/30 bg-red-500/5",
                                // Highlight wenn dieser spezifische Test gerade läuft
                                activeTestIndices.has(index) && "border-blue-500 bg-blue-500/5",
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">{getStatusIcon(result as TestCaseResult, index)}</div>
                                <div className="flex-1 min-w-0 space-y-3">
                                    {/* Question */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-xs">
                                                #{index + 1}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">Frage</span>
                                        </div>
                                        <p className="text-sm">{result.question}</p>
                                    </div>

                                    {/* Expected Answer */}
                                    <div>
                                        <span
                                            className="text-xs text-muted-foreground block mb-1">Erwartete Antwort</span>
                                        <p className="text-sm bg-muted/50 rounded p-2">{result.expectedAnswer}</p>
                                    </div>

                                    {/* Actual Answer */}
                                    {result.actualAnswer && (
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-xs text-muted-foreground block mb-1">Tatsächliche Antwort</span>
                                                <p className={cn(
                                                    "text-sm rounded p-2",
                                                    result.passed === true && "bg-green-500/10",
                                                    result.passed === false && "bg-red-500/10",
                                                )}>
                                                    {result.actualAnswer}
                                                </p>
                                            </div>

                                            {/* Explanation Box */}
                                            {result.explanation && (
                                                <div
                                                    className="flex items-start gap-2 bg-blue-50 text-blue-900 rounded p-2 text-xs border border-blue-100">
                                                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500"/>
                                                    <div>
                                                        <span
                                                            className="font-semibold block mb-0.5">KI-Bewertung:</span>
                                                        {result.explanation}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Manual Validation Buttons */}
                                    {result.actualAnswer && run && (
                                        <div className="flex items-center gap-2 pt-2">
                                            <span className="text-xs text-muted-foreground">Manuelle Bewertung:</span>
                                            <Button
                                                variant={result.passed === true ? "default" : "outline"}
                                                size="sm"
                                                className={cn("h-7", result.passed === true && "bg-green-500 hover:bg-green-600")}
                                                onClick={() => handleManualValidation(result.testCaseId, true)}
                                            >
                                                <CheckCircle2 className="h-3 w-3 mr-1"/>
                                                Bestanden
                                            </Button>
                                            <Button
                                                variant={result.passed === false ? "default" : "outline"}
                                                size="sm"
                                                className={cn("h-7", result.passed === false && "bg-red-500 hover:bg-red-600")}
                                                onClick={() => handleManualValidation(result.testCaseId, false)}
                                            >
                                                <XCircle className="h-3 w-3 mr-1"/>
                                                Fehlgeschlagen
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}