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
    Database,
    Info,
    Loader2,
    MessageSquare,
    PenTool,
    Play,
    RefreshCw,
    Search,
    Star,
    Target,
    XCircle
} from "lucide-react"
import type {TestCaseResult, TestRun, TestSuite} from "@/lib/test-suite-types"
import {createTestRunApi, runTestQuestion, updateTestRunApi, updateTestRunResultApi, validateAnswer} from "@/lib/api"
import {cn} from "@/lib/utils"

interface ExtendedTestCaseResult extends TestCaseResult {
    retrievalRecall?: number;
    answerPrecision?: number;
    llmExtractedArticles?: string[];
}

interface TestRunPanelProps {
    suite: TestSuite
    existingRun?: TestRun | null
    onRunUpdated: (run: TestRun) => void
    onBack: () => void
    onHistoryChanged?: () => void
}

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

    // Set für parallele Lade-Indikatoren
    const [activeTestIndices, setActiveTestIndices] = React.useState<Set<number>>(new Set())

    const [strategy, setStrategy] = React.useState(existingRun?.strategy || "llm-neurosymbolic")
    const [comment, setComment] = React.useState(existingRun?.comment || "")
    const [showComment, setShowComment] = React.useState(false)

    // Cast auf Extended für die UI Logik
    const results = (run?.results || []) as ExtendedTestCaseResult[]

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

        let currentResults = [...targetRun.results] as ExtendedTestCaseResult[]
        let passedCount = 0

        const runSingleTest = async (result: TestCaseResult, index: number) => {
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
                // HINWEIS: Hier gehen wir davon aus, dass updateTestRunResultApi oder das Backend
                // die Berechnung von Precision/Recall übernimmt, oder wir müssten es hier berechnen.
                // Wir senden die Rohdaten, das Backend (App.py) macht die Mathe.
                const updatedResultFromApi = await updateTestRunResultApi(
                    targetRun.id,
                    result.testCaseId,
                    response.answer,
                    validation.passed,
                    validation.explanation,
                    validation.similarity,
                    response.retrievedArticles ?? [],     // Argument 7
                    result.expectedArticles ?? [],        // Argument 8
                    response.llmExtractedArticles ?? []
                )

                // D. Lokales Update (Optimistisch oder basierend auf API Return)
                currentResults[index] = {
                    ...result,
                    actualAnswer: response.answer,
                    passed: validation.passed,
                    explanation: validation.explanation,
                    retrievedArticles: response.retrievedArticles,
                    expectedArticles: result.expectedArticles,

                    // NEUES MAPPING: Snake Case vom Backend auf Camel Case
                    retrievalRecall: (updatedResultFromApi as any)?.retrieval_recall ?? 0,
                    answerPrecision: (updatedResultFromApi as any)?.answer_precision ?? 0,

                    llmExtractedArticles: (updatedResultFromApi as any)?.llm_extracted_articles ?? []
                }

                setRun(prev => prev ? {...prev, results: [...currentResults]} : null)

                if (validation.passed) passedCount++

            } catch (error) {
                console.error(`Test ${index} failed:`, error)
                await updateTestRunResultApi(targetRun.id, result.testCaseId, "Error", false, String(error))
                currentResults[index] = {...result, actualAnswer: "Error", passed: false, explanation: String(error)}
                setRun(prev => prev ? {...prev, results: [...currentResults]} : null)

            } finally {
                setActiveTestIndices(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(index)
                    return newSet
                })
            }
        }

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

    // ... (handleToggleFavorite, handleSaveComment, handleManualValidation bleiben gleich) ...
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
        if (activeTestIndices.has(index)) {
            return <Loader2 className="h-5 w-5 animate-spin text-blue-500"/>
        }
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

    const displayItems = (run
        ? run.results
        : suite.testCases.map((tc) => ({
            testCaseId: tc.id,
            question: tc.question,
            expectedAnswer: tc.expectedAnswer,
            actualAnswer: "",
            passed: null,
            explanation: "",
            retrievedArticles: [],
            expectedArticles: [],
            llmExtractedArticles: [],
            retrievalRecall: 0, // Default Update
            answerPrecision: 0, // Default Update
        }))) as ExtendedTestCaseResult[]

    return (
        <div className="flex flex-col h-full overflow-hidden">
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
                            <SelectItem value="rule-based">Rule Based</SelectItem>
                            <SelectItem value="llm-based-simple">LLM Based Simple</SelectItem>
                            <SelectItem value="llm-neurosymbolic">LLM Neuro Symbolic</SelectItem>
                            <SelectItem value="concept-template">Template Based</SelectItem>
                            <SelectItem value="fast-to-g">Fast To G</SelectItem>
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
            <div className="flex-1 relative min-h-0">
                <ScrollArea className="absolute inset-0 h-full w-full">
                    <div className="p-4 space-y-4">
                        {displayItems.map((result, index) => {
                            const retrieved = result.retrievedArticles || [];
                            const expected = result.expectedArticles || [];
                            const llmUsed = result.llmExtractedArticles || [];

                            // Sichere Defaults
                            const recallDB = result.retrievalRecall ? Math.round(result.retrievalRecall * 100) : 0;
                            const precisionLLM = result.answerPrecision ? Math.round(result.answerPrecision * 100) : 0;

                            const showGrid = expected.length > 0 || retrieved.length > 0 || llmUsed.length > 0;

                            return (
                                <div
                                    key={result.testCaseId}
                                    className={cn(
                                        "border rounded-lg p-4 transition-colors",
                                        result.passed === true && "border-green-500/30 bg-green-500/5",
                                        result.passed === false && "border-red-500/30 bg-red-500/5",
                                        activeTestIndices.has(index) && "border-blue-500 bg-blue-500/5",
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5">{getStatusIcon(result, index)}</div>
                                        <div className="flex-1 min-w-0 space-y-3">
                                            {/* Question & Expected */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        #{index + 1}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">Frage</span>
                                                </div>
                                                <p className="text-sm font-medium">{result.question}</p>
                                                <p className="text-xs text-muted-foreground mt-2 mb-1">Erwartete
                                                    Antwort:</p>
                                                <p className="text-sm bg-muted/50 rounded p-2 text-muted-foreground">{result.expectedAnswer}</p>
                                            </div>

                                            {/* --- NEU: DREI-SÄULEN GRID --- */}
                                            {showGrid && (
                                                <div className="bg-white/60 border rounded-md overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x mt-2">

                                                    {/* SÄULE 1: TARGET (Bleibt gleich) */}
                                                    <div className="p-3 space-y-2 bg-slate-50/50">
                                                        {/* ... Inhalt Target Articles ... */}
                                                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                            <Target className="h-3.5 w-3.5"/> Target Articles
                                                        </div>
                                                        {expected.length > 0 ? (
                                                            <ul className="space-y-1.5">
                                                                {expected.map((art, i) => (
                                                                    <li key={i} className="flex items-start gap-2 text-sm">
                                                                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"/>
                                                                        <span>{art}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic pl-3">Keine definiert</span>
                                                        )}
                                                    </div>

                                                    {/* SÄULE 2: CONTEXT (JETZT RECALL) */}
                                                    <div className="p-3 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
                                                                <Database className="h-3.5 w-3.5"/> Retrieved (DB)
                                                            </div>
                                                            {/* Badge zeigt jetzt RECALL an */}
                                                            <Badge variant="outline" className={cn(
                                                                "text-[10px] h-5",
                                                                recallDB === 100 ? "bg-green-100 text-green-700 border-green-200" :
                                                                    recallDB < 50 ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"
                                                            )}>
                                                                Recall: {recallDB}%
                                                            </Badge>
                                                        </div>
                                                        {/* Liste der Retrieved Articles */}
                                                        {retrieved.length > 0 ? (
                                                            <ul className="space-y-1.5">
                                                                {retrieved.map((art, i) => {
                                                                    const isHit = expected.some(e => e.replace(/\s/g, '').toLowerCase() === art.replace(/\s/g, '').toLowerCase());
                                                                    return (
                                                                        <li key={i} className="flex items-start gap-2 text-sm">
                                                                            <Search className={cn("h-3 w-3 mt-1 shrink-0", isHit ? "text-green-500" : "text-slate-300")}/>
                                                                            <span className={cn(isHit ? "text-green-700 font-medium" : "text-slate-500")}>{art}</span>
                                                                        </li>
                                                                    )
                                                                })}
                                                            </ul>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic pl-5">Nichts gefunden</span>
                                                        )}
                                                    </div>

                                                    {/* SÄULE 3: RESPONSE (JETZT PRECISION) */}
                                                    <div className="p-3 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 uppercase tracking-wider">
                                                                <PenTool className="h-3.5 w-3.5"/> Used (LLM)
                                                            </div>
                                                            {/* Badge zeigt jetzt PRECISION an */}
                                                            <Badge variant="outline" className={cn(
                                                                "text-[10px] h-5",
                                                                precisionLLM === 100 ? "bg-green-100 text-green-700 border-green-200" :
                                                                    precisionLLM < 50 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"
                                                            )}>
                                                                Precision: {precisionLLM}%
                                                            </Badge>
                                                        </div>
                                                        {/* Liste der LLM Used Articles */}
                                                        {llmUsed.length > 0 ? (
                                                            <ul className="space-y-1.5">
                                                                {llmUsed.map((art, i) => {
                                                                    const isHit = expected.some(e => e.replace(/\s/g, '').toLowerCase() === art.replace(/\s/g, '').toLowerCase());
                                                                    return (
                                                                        <li key={i} className="flex items-start gap-2 text-sm">
                                                                <span className={cn(
                                                                    "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                                                                    isHit ? "bg-green-500" : "bg-purple-300"
                                                                    // Purple = Halluziniert/Irrelevant, Green = Relevant
                                                                )}/>
                                                                            <span className={cn(isHit && "text-green-700 font-medium")}>{art}</span>
                                                                        </li>
                                                                    )
                                                                })}
                                                            </ul>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic pl-3">Keine Zitate erkannt</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actual Answer */}
                                            {result.actualAnswer && (
                                                <div className="space-y-2 pt-2">
                                                    <div>
                                                        <span className="text-xs text-muted-foreground block mb-1">Tatsächliche Antwort</span>
                                                        <div className={cn(
                                                            "text-sm rounded p-3 border",
                                                            result.passed === true ? "bg-green-50/50 border-green-100" :
                                                                result.passed === false ? "bg-red-50/50 border-red-100" : "bg-slate-50 border-slate-100"
                                                        )}>
                                                            {result.actualAnswer}
                                                        </div>
                                                    </div>

                                                    {/* Explanation Box */}
                                                    {result.explanation && (
                                                        <div
                                                            className="flex items-start gap-2 bg-blue-50 text-blue-900 rounded p-2 text-xs border border-blue-100">
                                                            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500"/>
                                                            <div className="leading-relaxed">
                                                                <span className="font-semibold mr-1">Validierung:</span>
                                                                {result.explanation}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Manual Validation Buttons */}
                                            {result.actualAnswer && run && (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <span className="text-xs text-muted-foreground">Manuell überschreiben:</span>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant={result.passed === true ? "default" : "ghost"}
                                                            size="sm"
                                                            className={cn("h-6 px-2 text-xs", result.passed === true && "bg-green-600 hover:bg-green-700")}
                                                            onClick={() => handleManualValidation(result.testCaseId, true)}
                                                        >
                                                            Bestanden
                                                        </Button>
                                                        <Button
                                                            variant={result.passed === false ? "default" : "ghost"}
                                                            size="sm"
                                                            className={cn("h-6 px-2 text-xs", result.passed === false && "bg-red-600 hover:bg-red-700")}
                                                            onClick={() => handleManualValidation(result.testCaseId, false)}
                                                        >
                                                            Fehlgeschlagen
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        <div className="h-8"></div>
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}