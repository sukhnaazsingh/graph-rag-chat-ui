"use client"

import * as React from "react"
import {Button} from "@/components/ui/button"
import {ScrollArea} from "@/components/ui/scroll-area"
import {Badge} from "@/components/ui/badge"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {
    CheckCircle2,
    Clock,
    Eye,
    GripVertical,
    Loader2,
    MessageSquare,
    MoreVertical,
    Star,
    Trash2,
    XCircle
} from "lucide-react"
import type {TestRun} from "@/lib/test-suite-types"
import {cn} from "@/lib/utils"
// API Imports statt Store
import {deleteTestRunApi, fetchTestRuns, updateTestRunApi} from "@/lib/api"

interface TestRunHistoryProps {
    suiteId?: string
    onSelectRun: (run: TestRun) => void
    selectedRunId?: string
    refreshKey?: number
}

export function TestRunHistory({suiteId, onSelectRun, selectedRunId, refreshKey}: TestRunHistoryProps) {
    const [runs, setRuns] = React.useState<TestRun[]>([])
    const [loading, setLoading] = React.useState(true)
    const [draggedId, setDraggedId] = React.useState<string | null>(null)
    const [dragOverId, setDragOverId] = React.useState<string | null>(null)

    const loadRuns = React.useCallback(async () => {
        try {
            setLoading(true)
            const allRuns = await fetchTestRuns()

            // Filterung passiert aktuell client-side (könnte man später ins Backend verlagern)
            let filtered = allRuns
            if (suiteId) {
                filtered = allRuns.filter(r => r.suiteId === suiteId)
            }

            // Sortierung: Neueste zuerst
            setRuns(filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()))
        } catch (error) {
            console.error("Failed to load history", error)
        } finally {
            setLoading(false)
        }
    }, [suiteId])

    React.useEffect(() => {
        loadRuns()
    }, [loadRuns, refreshKey])

    // Favoriten filtern und nach favoriteOrder sortieren
    const favoriteRuns = React.useMemo(() =>
            runs.filter((r) => r.isFavorite).sort((a, b) => (a.favoriteOrder || 0) - (b.favoriteOrder || 0)),
        [runs])

    const recentRuns = runs.slice(0, 20)

    const handleDelete = async (runId: string) => {
        if (confirm("Möchten Sie diesen Run wirklich löschen?")) {
            try {
                await deleteTestRunApi(runId)
                await loadRuns()
            } catch (error) {
                alert("Fehler beim Löschen")
            }
        }
    }

    // --- Drag & Drop Logic (angepasst für API) ---

    const handleDragStart = (e: React.DragEvent, runId: string) => {
        setDraggedId(runId)
        e.dataTransfer.effectAllowed = "move"
    }

    const handleDragOver = (e: React.DragEvent, runId: string) => {
        e.preventDefault()
        if (draggedId && draggedId !== runId) {
            setDragOverId(runId)
        }
    }

    const handleDragLeave = () => {
        setDragOverId(null)
    }

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault()
        if (!draggedId || draggedId === targetId) return

        const draggedIndex = favoriteRuns.findIndex((r) => r.id === draggedId)
        const targetIndex = favoriteRuns.findIndex((r) => r.id === targetId)

        if (draggedIndex === -1 || targetIndex === -1) return

        // 1. Neue Reihenfolge lokal berechnen (für sofortiges Feedback wäre komplexer, wir machen hier Reload)
        const newOrderList = [...favoriteRuns]
        const [removed] = newOrderList.splice(draggedIndex, 1)
        newOrderList.splice(targetIndex, 0, removed)

        // 2. Optimistic Update (damit es nicht ruckelt)
        // Wir updaten die lokale State Kopie temporär
        const updatedRunsState = runs.map(r => {
            const indexInNewOrder = newOrderList.findIndex(item => item.id === r.id)
            if (indexInNewOrder !== -1) {
                return {...r, favoriteOrder: indexInNewOrder}
            }
            return r
        })
        setRuns(updatedRunsState)

        setDraggedId(null)
        setDragOverId(null)

        // 3. API Updates senden (Batch update wäre besser, aber Loop geht auch)
        try {
            const updatePromises = newOrderList.map((run, index) =>
                updateTestRunApi(run.id, {favoriteOrder: index})
            )
            await Promise.all(updatePromises)
        } catch (error) {
            console.error("Failed to reorder favorites", error)
            loadRuns() // Rollback bei Fehler
        }
    }

    const handleDragEnd = () => {
        setDraggedId(null)
        setDragOverId(null)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString("de-CH", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    const RunCard = ({run, isDraggable = false}: { run: TestRun; isDraggable?: boolean }) => {
        const passedCount = run.results.filter((r) => r.passed === true).length
        const failedCount = run.results.filter((r) => r.passed === false).length

        return (
            <div
                className={cn(
                    "border rounded-lg p-3 cursor-pointer transition-all hover:border-primary/50 bg-card",
                    selectedRunId === run.id && "border-primary bg-primary/5",
                    dragOverId === run.id && "border-blue-500 bg-blue-500/10",
                    draggedId === run.id && "opacity-50",
                )}
                onClick={() => onSelectRun(run)}
                draggable={isDraggable}
                onDragStart={(e) => isDraggable && handleDragStart(e, run.id)}
                onDragOver={(e) => isDraggable && handleDragOver(e, run.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => isDraggable && handleDrop(e, run.id)}
                onDragEnd={handleDragEnd}
            >
                <div className="flex items-start gap-2">
                    {isDraggable && (
                        <div
                            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                            <GripVertical className="h-4 w-4"/>
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span
                                    className="font-medium text-sm truncate">{run.suiteName || "Unbekannte Suite"}</span>
                                {run.isFavorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0"/>}
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <MoreVertical className="h-3 w-3"/>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onSelectRun(run)
                                        }}
                                    >
                                        <Eye className="h-4 w-4 mr-2"/>
                                        Anzeigen
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDelete(run.id)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2"/>
                                        Löschen
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3"/>
                  {formatDate(run.startedAt)}
              </span>
                            <Badge variant="outline" className="text-[10px] h-5">
                                {run.strategy === "llm-strategy" ? "LLM" : "Rule"}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3"/>
                  {passedCount}
              </span>
                            <span className="flex items-center gap-1 text-xs text-red-600">
                <XCircle className="h-3 w-3"/>
                                {failedCount}
              </span>
                            <span className="text-xs text-muted-foreground">({Math.round(run.passRate)}% Pass)</span>
                            {run.comment && <MessageSquare className="h-3 w-3 text-muted-foreground ml-auto"/>}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (loading && runs.length === 0) {
        return <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2"/>
            Lade History...
        </div>
    }

    return (
        <Tabs defaultValue="favorites" className="flex flex-col h-full">
            <div className="border-b px-4">
                <TabsList className="grid w-full grid-cols-2 bg-transparent h-10">
                    <TabsTrigger value="favorites" className="gap-2 data-[state=active]:bg-muted">
                        <Star className="h-4 w-4"/>
                        Favoriten ({favoriteRuns.length})
                    </TabsTrigger>
                    <TabsTrigger value="recent" className="gap-2 data-[state=active]:bg-muted">
                        <Clock className="h-4 w-4"/>
                        Verlauf ({recentRuns.length})
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="favorites" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="p-4 space-y-2">
                        {favoriteRuns.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <Star className="h-10 w-10 mx-auto mb-3 opacity-30"/>
                                <p className="text-sm">Keine Favoriten vorhanden.</p>
                                <p className="text-xs mt-1">Markieren Sie Runs als Favorit um sie hier zu sehen.</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-muted-foreground mb-3">Ziehen Sie Favoriten um die
                                    Reihenfolge zu ändern.</p>
                                {favoriteRuns.map((run) => (
                                    <RunCard key={run.id} run={run} isDraggable/>
                                ))}
                            </>
                        )}
                    </div>
                </ScrollArea>
            </TabsContent>

            <TabsContent value="recent" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="p-4 space-y-2">
                        {recentRuns.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30"/>
                                <p className="text-sm">Noch keine Test Runs vorhanden.</p>
                            </div>
                        ) : (
                            recentRuns.map((run) => <RunCard key={run.id} run={run}/>)
                        )}
                    </div>
                </ScrollArea>
            </TabsContent>
        </Tabs>
    )
}