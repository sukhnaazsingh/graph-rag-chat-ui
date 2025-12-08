"use client"

import * as React from "react"
import {Button} from "@/components/ui/button"
import {ScrollArea} from "@/components/ui/scroll-area"
import {FileText, Upload, MoreVertical, CheckCircle2, AlertCircle, Loader2, Trash2} from "lucide-react"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {Badge} from "@/components/ui/badge"
import {Progress} from "@/components/ui/progress"
import {fetchDocuments, uploadDocument} from "@/lib/api"

interface Document {
    id: number
    filename: string
    file_size: string
    status: "uploaded" | "processing" | "ready" | "error"
    upload_date: string
}

export function DocumentPanel() {
    const [documents, setDocuments] = React.useState<Document[]>([])
    const [isUploading, setIsUploading] = React.useState(false)

    // Ref initialisieren
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const loadDocs = async () => {
        try {
            const docs = await fetchDocuments()
            const sorted = docs.sort((a: Document, b: Document) =>
                new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime()
            )
            setDocuments(sorted)
        } catch (e) {
            console.error("Failed to load docs", e)
        }
    }

    React.useEffect(() => {
        loadDocs()
        const interval = setInterval(loadDocs, 5000)
        return () => clearInterval(interval)
    }, [])

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setIsUploading(true)
            try {
                await uploadDocument(file)
                await loadDocs()
            } catch (error) {
                console.error("Upload error", error)
            } finally {
                setIsUploading(false)
                if (fileInputRef.current) fileInputRef.current.value = ""
            }
        }
    }

    // Diese Funktion erzwingt das Öffnen des Dialogs
    const triggerFileInput = () => {
        console.log("Triggering file input...") // Debugging
        fileInputRef.current?.click()
    }

    return (
        <div className="flex h-full flex-col bg-background"> {/* bg-background wichtig! */}
            <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Knowledge Base</h3>
                <Badge variant="secondary" className="text-xs">
                    {documents.length} Files
                </Badge>
            </div>

            <div className="p-4 border-b bg-muted/30">
                {/* WICHTIG: Das Input ist HIER, aber unsichtbar.
            Es liegt NICHT im Click-Bereich, um Event-Probleme zu vermeiden.
        */}
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileChange}
                />

                {/* Der klickbare Bereich ruft explizit die Funktion auf */}
                <div
                    onClick={triggerFileInput}
                    className="rounded-lg border border-dashed border-muted-foreground/25 bg-background p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                >
                    <div
                        className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted pointer-events-none">
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin"/> :
                            <Upload className="h-4 w-4 text-muted-foreground"/>}
                    </div>
                    <p className="text-sm font-medium pointer-events-none">
                        {isUploading ? "Uploading..." : "Upload Documents"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 pointer-events-none">
                        Click here to select files
                    </p>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 p-2">
                    {/* ... Gleicher List Code wie vorher ... */}
                    {documents.map((doc) => (
                        <div key={doc.id}
                             className="group flex items-start gap-3 rounded-lg border border-transparent p-3 hover:bg-muted/50 transition-all">
                            <div
                                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <FileText className="h-4 w-4"/>
                            </div>
                            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                                <span className="truncate text-sm font-medium">{doc.filename}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{doc.status}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}