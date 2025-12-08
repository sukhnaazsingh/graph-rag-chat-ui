"use client"

import * as React from "react"
import {Button} from "@/components/ui/button"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import {ScrollArea} from "@/components/ui/scroll-area"
import {Badge} from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {CheckCircle, HelpCircle, Loader2, Pencil, Play, Plus, Trash2} from "lucide-react"
import type {TestCase, TestSuite} from "@/lib/test-suite-types"
// Alte Store Imports entfernt -> Neue API Imports
import {createTestCaseApi, deleteTestCaseApi, fetchTestSuites, updateTestCaseApi} from "@/lib/api"

interface TestCaseEditorProps {
    suite: TestSuite
    onSuiteUpdated: (suite: TestSuite) => void
    onRunTests: () => void
}

export function TestCaseEditor({suite, onSuiteUpdated, onRunTests}: TestCaseEditorProps) {
    const [isAddOpen, setIsAddOpen] = React.useState(false)
    const [editingCase, setEditingCase] = React.useState<TestCase | null>(null)
    const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null)

    // Loading State für API Operationen
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const [formData, setFormData] = React.useState({question: "", expectedAnswer: ""})

    // Lädt die aktuelle Suite neu vom Server
    const refreshSuite = async () => {
        try {
            const suites = await fetchTestSuites()
            const updated = suites.find((s) => s.id === suite.id)
            if (updated) onSuiteUpdated(updated)
        } catch (error) {
            console.error("Failed to refresh suite:", error)
        }
    }

    const handleAdd = async () => {
        if (!formData.question.trim() || !formData.expectedAnswer.trim()) return

        setIsSubmitting(true)
        try {
            await createTestCaseApi(suite.id, formData.question.trim(), formData.expectedAnswer.trim())
            await refreshSuite()
            setFormData({question: "", expectedAnswer: ""})
            setIsAddOpen(false)
        } catch (error) {
            console.error(error)
            alert("Fehler beim Hinzufügen")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleUpdate = async () => {
        if (!editingCase || !formData.question.trim() || !formData.expectedAnswer.trim()) return

        setIsSubmitting(true)
        try {
            await updateTestCaseApi(editingCase.id, {
                question: formData.question.trim(),
                expectedAnswer: formData.expectedAnswer.trim(),
            })
            await refreshSuite()
            setEditingCase(null)
            setFormData({question: "", expectedAnswer: ""})
        } catch (error) {
            console.error(error)
            alert("Fehler beim Aktualisieren")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteConfirm) return

        setIsSubmitting(true)
        try {
            await deleteTestCaseApi(deleteConfirm)
            await refreshSuite()
            setDeleteConfirm(null)
        } catch (error) {
            console.error(error)
            alert("Fehler beim Löschen")
        } finally {
            setIsSubmitting(false)
        }
    }

    const openEditDialog = (testCase: TestCase) => {
        setFormData({question: testCase.question, expectedAnswer: testCase.expectedAnswer})
        setEditingCase(testCase)
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div>
                    <h2 className="font-semibold text-lg">{suite.name}</h2>
                    {suite.description && <p className="text-sm text-muted-foreground mt-0.5">{suite.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)}>
                        <Plus className="h-4 w-4 mr-1"/>
                        Test Case
                    </Button>
                    <Button size="sm" onClick={onRunTests} disabled={suite.testCases.length === 0}>
                        <Play className="h-4 w-4 mr-1"/>
                        Run Tests
                    </Button>
                </div>
            </div>

            {/* Test Cases List */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                    {suite.testCases.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12">
                            <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                            <p className="text-sm">Noch keine Test Cases vorhanden.</p>
                            <p className="text-xs mt-1">Fügen Sie Fragen und erwartete Antworten hinzu.</p>
                            <Button variant="outline" size="sm" className="mt-4 bg-transparent"
                                    onClick={() => setIsAddOpen(true)}>
                                <Plus className="h-4 w-4 mr-1"/>
                                Ersten Test Case hinzufügen
                            </Button>
                        </div>
                    ) : (
                        suite.testCases.map((testCase, index) => (
                            <div
                                key={testCase.id}
                                className="border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="text-xs">
                                                    #{index + 1}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">Frage</span>
                                            </div>
                                            <p className="text-sm">{testCase.question}</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <CheckCircle className="h-3 w-3 text-green-500"/>
                                                <span className="text-xs text-muted-foreground">Erwartete Antwort</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2">{testCase.expectedAnswer}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                                onClick={() => openEditDialog(testCase)}>
                                            <Pencil className="h-4 w-4"/>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteConfirm(testCase.id)}
                                        >
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            {/* Add Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Test Case hinzufügen</DialogTitle>
                        <DialogDescription>Fügen Sie eine Frage und die erwartete Antwort hinzu.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="question">Frage</Label>
                            <Textarea
                                id="question"
                                value={formData.question}
                                onChange={(e) => setFormData({...formData, question: e.target.value})}
                                placeholder="z.B. Was ist die Hauptfunktion von Produkt X?"
                                rows={3}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="expectedAnswer">Erwartete Antwort</Label>
                            <Textarea
                                id="expectedAnswer"
                                value={formData.expectedAnswer}
                                onChange={(e) => setFormData({...formData, expectedAnswer: e.target.value})}
                                placeholder="Die erwartete Antwort oder Kernaussagen..."
                                rows={4}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>
                            Abbrechen
                        </Button>
                        <Button onClick={handleAdd}
                                disabled={!formData.question.trim() || !formData.expectedAnswer.trim() || isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Hinzufügen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editingCase} onOpenChange={(open) => !open && !isSubmitting && setEditingCase(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Test Case bearbeiten</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-question">Frage</Label>
                            <Textarea
                                id="edit-question"
                                value={formData.question}
                                onChange={(e) => setFormData({...formData, question: e.target.value})}
                                rows={3}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-expectedAnswer">Erwartete Antwort</Label>
                            <Textarea
                                id="edit-expectedAnswer"
                                value={formData.expectedAnswer}
                                onChange={(e) => setFormData({...formData, expectedAnswer: e.target.value})}
                                rows={4}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingCase(null)} disabled={isSubmitting}>
                            Abbrechen
                        </Button>
                        <Button onClick={handleUpdate}
                                disabled={!formData.question.trim() || !formData.expectedAnswer.trim() || isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Speichern
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteConfirm}
                         onOpenChange={(open) => !open && !isSubmitting && setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Test Case löschen?</AlertDialogTitle>
                        <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht
                            werden.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault() // Verhindert schließen vor API Call
                                handleDelete()
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}