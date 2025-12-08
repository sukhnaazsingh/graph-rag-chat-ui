"use client"

import * as React from "react"
import {Button} from "@/components/ui/button"
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import {ScrollArea} from "@/components/ui/scroll-area"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {FileText, FlaskConical, MoreVertical, Pencil, Plus, Trash2} from "lucide-react"
import type {TestSuite} from "@/lib/test-suite-types"
import {createTestSuiteApi, deleteTestSuiteApi, fetchTestSuites, updateTestSuiteApi} from "@/lib/api";

interface TestSuiteListProps {
    onSelectSuite: (suite: TestSuite) => void
    selectedSuiteId?: string
}

export function TestSuiteList({onSelectSuite, selectedSuiteId}: TestSuiteListProps) {
    const [suites, setSuites] = React.useState<TestSuite[]>([])
    const [loading, setLoading] = React.useState(true)
    const [isCreateOpen, setIsCreateOpen] = React.useState(false)
    const [editingSuite, setEditingSuite] = React.useState<TestSuite | null>(null)
    const [formData, setFormData] = React.useState({name: "", description: ""})

    const loadSuites = React.useCallback(async () => {
        try {
            setLoading(true)
            const data = await fetchTestSuites()
            setSuites(data)
        } catch (e) {
            console.error("Failed to load suites", e)
        } finally {
            setLoading(false)
        }
    }, [])
    // Load suites
    React.useEffect(() => {
        loadSuites()
    }, [loadSuites])

    const handleCreate = async () => {
        if (!formData.name.trim()) return
        try {
            const newSuite = await createTestSuiteApi(formData.name.trim(), formData.description.trim())
            await loadSuites() // Reload list
            setFormData({name: "", description: ""})
            setIsCreateOpen(false)
            onSelectSuite(newSuite)
        } catch (e) {
            console.error(e)
        }
    }

    const handleUpdate = () => {
        if (!editingSuite || !formData.name.trim()) return
        updateTestSuiteApi(editingSuite.id, {
            name: formData.name.trim(),
            description: formData.description.trim(),
        })
        loadSuites()
        setEditingSuite(null)
        setFormData({name: "", description: ""})
    }

    const handleDelete = async (suiteId: string) => {
        if (confirm("Möchten Sie diese Test Suite wirklich löschen?")) {
            await deleteTestSuiteApi(suiteId)
            await loadSuites()
        }
    }

    const openEditDialog = (suite: TestSuite) => {
        setFormData({name: suite.name, description: suite.description})
        setEditingSuite(suite)
    }

    if (loading) {
        return <div>Lade Test Suites...</div>
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5"/>
                    <h2 className="font-semibold">Test Suites</h2>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="h-4 w-4 mr-1"/>
                            Neu
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Neue Test Suite erstellen</DialogTitle>
                            <DialogDescription>
                                Erstellen Sie eine neue Test Suite um Fragen und erwartete Antworten zu validieren.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    placeholder="z.B. Produktwissen Tests"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Beschreibung</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Optionale Beschreibung der Test Suite..."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                Abbrechen
                            </Button>
                            <Button onClick={handleCreate} disabled={!formData.name.trim()}>
                                Erstellen
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                    {suites.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                            <p className="text-sm">Noch keine Test Suites vorhanden.</p>
                            <p className="text-xs mt-1">Erstellen Sie eine neue Suite um zu beginnen.</p>
                        </div>
                    ) : (
                        suites.map((suite) => (
                            <Card
                                key={suite.id}
                                className={`cursor-pointer transition-all hover:border-primary/50 ${
                                    selectedSuiteId === suite.id ? "border-primary bg-primary/5" : ""
                                }`}
                                onClick={() => onSelectSuite(suite)}
                            >
                                <CardHeader className="p-3 pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <CardTitle className="text-sm font-medium truncate">{suite.name}</CardTitle>
                                            {suite.description && (
                                                <CardDescription
                                                    className="text-xs mt-1 line-clamp-2">{suite.description}</CardDescription>
                                            )}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4"/>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        openEditDialog(suite)
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4 mr-2"/>
                                                    Bearbeiten
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDelete(suite.id)
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2"/>
                                                    Löschen
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-3 pt-0">
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>{suite.testCases.length} Test Cases</span>
                                        <span>
                      {new Date(suite.updatedAt).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                      })}
                    </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>

            {/* Edit Dialog */}
            <Dialog open={!!editingSuite} onOpenChange={(open) => !open && setEditingSuite(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Test Suite bearbeiten</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-description">Beschreibung</Label>
                            <Textarea
                                id="edit-description"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingSuite(null)}>
                            Abbrechen
                        </Button>
                        <Button onClick={handleUpdate} disabled={!formData.name.trim()}>
                            Speichern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
