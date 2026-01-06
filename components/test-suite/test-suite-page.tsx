"use client"

import * as React from "react"
import {TestSuiteList} from "./test-suite-list"
import {TestCaseEditor} from "./test-case-editor"
import {TestRunPanel} from "./test-run-panel"
import {TestRunHistory} from "./test-run-history"
import {Button} from "@/components/ui/button"
import {ArrowLeft, FlaskConical, History} from "lucide-react"
import type {TestRun, TestSuite} from "@/lib/test-suite-types"
import {fetchTestSuites} from "@/lib/api"
import {cn} from "@/lib/utils"

interface TestSuitePageProps {
    onBack: () => void
}

export function TestSuitePage({onBack}: TestSuitePageProps) {
    const [selectedSuite, setSelectedSuite] = React.useState<TestSuite | null>(null)
    const [existingRun, setExistingRun] = React.useState<TestRun | null>(null)
    const [view, setView] = React.useState<"editor" | "run">("editor")
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(true)
    const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0)

    const triggerHistoryRefresh = () => {
        setHistoryRefreshKey((prev) => prev + 1)
    }

    const handleSelectSuite = (suite: TestSuite) => {
        setSelectedSuite(suite)
        setView("editor")
        setExistingRun(null)
    }

    const handleSuiteUpdated = (suite: TestSuite) => {
        setSelectedSuite(suite)
    }

    const handleRunTests = () => {
        if (!selectedSuite) return
        setExistingRun(null)
        setView("run")
    }

    const handleRunUpdated = (run: TestRun) => {
        setExistingRun(run)
        triggerHistoryRefresh()
    }

    const handleBackToEditor = () => {
        setView("editor")
        setExistingRun(null)
        // Wir könnten hier die Suite neu laden, falls sich was geändert hat
        if (selectedSuite) {
            refreshSelectedSuite(selectedSuite.id)
        }
    }

    // Hilfsfunktion: Suite neu laden
    const refreshSelectedSuite = async (suiteId: string) => {
        try {
            const suites = await fetchTestSuites()
            const updated = suites.find(s => s.id === suiteId)
            if (updated) setSelectedSuite(updated)
        } catch (e) {
            console.error("Failed to refresh suite", e)
        }
    }

    // --- HIER WAR DER FEHLER ---
    // Wir machen die Funktion async, um ggf. die Suite zu laden
    const handleSelectRun = React.useCallback(async (run: TestRun) => {

        // 1. Wir nutzen direkt das 'run' Objekt, das wir aus der History bekommen.
        // Es kommt aus der API und ist vollständig.

        // 2. Wir müssen sicherstellen, dass die passende Suite ausgewählt ist.
        // Das TestRunPanel braucht das "Suite" Objekt.
        let currentSuite = selectedSuite

        // Wenn keine Suite gewählt ist ODER die gewählte Suite nicht zum Run passt:
        if (!currentSuite || currentSuite.id !== run.suiteId) {
            try {
                // Wir laden alle Suites um die richtige zu finden
                // (In einer echten App würde man fetchTestSuiteById machen, aber so gehts auch)
                const allSuites = await fetchTestSuites()
                const foundSuite = allSuites.find(s => s.id === run.suiteId)

                if (foundSuite) {
                    setSelectedSuite(foundSuite)
                } else {
                    console.error("Zugehörige Suite nicht gefunden")
                    return
                }
            } catch (error) {
                console.error("Fehler beim Laden der Suite für den Run", error)
                return
            }
        }

        // 3. State setzen
        setExistingRun(run)
        setView("run")

    }, [selectedSuite])

    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">
            {/* Left Sidebar - Suite List */}
            <div className="w-[280px] border-r bg-sidebar flex flex-col shrink-0 h-full">
                <div className="p-4 border-b">
                    <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
                        <ArrowLeft className="h-4 w-4"/>
                        Zurück zum Chat
                    </Button>
                </div>
                <TestSuiteList onSelectSuite={handleSelectSuite} selectedSuiteId={selectedSuite?.id}/>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full min-w-0 min-h-0 bg-background">
                {!selectedSuite && view === "editor" ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <FlaskConical className="h-16 w-16 mx-auto mb-4 opacity-30"/>
                            <h3 className="font-medium text-lg">Test Suite auswählen</h3>
                            <p className="text-sm mt-1">Wählen Sie eine Test Suite aus der Liste oder erstellen Sie eine
                                neue.</p>
                        </div>
                    </div>
                ) : view === "editor" && selectedSuite ? (
                    <TestCaseEditor suite={selectedSuite} onSuiteUpdated={handleSuiteUpdated}
                                    onRunTests={handleRunTests}/>
                ) : selectedSuite ? (
                    <TestRunPanel
                        suite={selectedSuite}
                        existingRun={existingRun}
                        onRunUpdated={handleRunUpdated}
                        onBack={handleBackToEditor}
                        onHistoryChanged={triggerHistoryRefresh}
                    />
                ) : null}
            </main>

            {/* Right Sidebar - Run History */}
            <div
                className={cn(
                    "border-l bg-sidebar transition-all duration-300 ease-in-out flex flex-col h-full",
                    isHistoryOpen ? "w-[320px]" : "w-0 border-l-0",
                )}
            >
                <div className={cn("w-[320px] h-full flex flex-col overflow-hidden", !isHistoryOpen && "hidden")}>
                    <div className="p-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4"/>
                            <span className="font-medium">Run History</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsHistoryOpen(false)}>
                            <ArrowLeft className="h-4 w-4 rotate-180"/>
                        </Button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <TestRunHistory
                            suiteId={selectedSuite?.id}
                            onSelectRun={handleSelectRun}
                            selectedRunId={existingRun?.id}
                            refreshKey={historyRefreshKey}
                        />
                    </div>
                </div>
            </div>

            {!isHistoryOpen && (
                <Button
                    variant="outline"
                    size="sm"
                    className="fixed right-4 bottom-4 z-50 shadow-md bg-background"
                    onClick={() => setIsHistoryOpen(true)}
                >
                    <History className="h-4 w-4 mr-2"/>
                    History
                </Button>
            )}
        </div>
    )
}