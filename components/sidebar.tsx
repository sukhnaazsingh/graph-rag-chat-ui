"use client"

import * as React from "react"
import {Button} from "@/components/ui/button"
import {ScrollArea} from "@/components/ui/scroll-area"
import {FlaskConical, Loader2, MessageSquare, Plus, Search} from "lucide-react"
import {Input} from "@/components/ui/input"
import {fetchSessions} from "@/lib/api"
import {cn} from "@/lib/utils"

// Typdefinition passend zum Backend
interface ChatSession {
    id: string
    title: string
    createdAt: string
}

interface SidebarProps {
    currentSessionId?: string
    onSelectSession: (sessionId: string) => void
    onNewChat: () => void
    onOpenTestSuites?: () => void
}

export function Sidebar({currentSessionId, onSelectSession, onNewChat, onOpenTestSuites}: SidebarProps) {
    const [sessions, setSessions] = React.useState<ChatSession[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [searchTerm, setSearchTerm] = React.useState("")

    // Sessions vom Backend laden
    const loadSessions = async () => {
        try {
            const data = await fetchSessions()
            setSessions(data)
        } catch (error) {
            console.error("Failed to load sessions", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Initial laden und wenn sich die Session ID ändert (z.B. neuer Titel nach erster Nachricht)
    React.useEffect(() => {
        loadSessions()
    }, [currentSessionId])

    // Einfache Suche/Filterung im Client
    const filteredSessions = sessions.filter((session) =>
        (session.title || "New Chat").toLowerCase().includes(searchTerm.toLowerCase()),
    )

    // Datumsformatierung helper (Repariert)
    const formatDate = (dateString: string | null | undefined) => {
        // 1. Check: Ist der String leer/null?
        if (!dateString) return "Unbekanntes Datum"

        const date = new Date(dateString)

        // 2. Check: Ist das Datum gültig? (Prüfung auf "Invalid Date")
        if (isNaN(date.getTime())) {
            return "Ungültiges Format"
        }

        try {
            return new Intl.DateTimeFormat("de-CH", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            }).format(date)
        } catch (e) {
            return dateString // Fallback, falls Formatierung fehlschlägt
        }
    }

    return (
        <div className="flex h-full flex-col gap-4 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                    <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <div className="h-4 w-4 rounded-full border-2 border-current"/>
                    </div>
                    <span>GraphChat</span>
                </div>
            </div>

            {/* New Chat Button */}
            <Button className="w-full justify-start gap-2" size="lg" onClick={onNewChat}>
                <Plus className="h-4 w-4"/>
                New Chat
            </Button>

            <Button variant="outline" className="w-full justify-start gap-2 bg-transparent" onClick={onOpenTestSuites}>
                <FlaskConical className="h-4 w-4"/>
                Test Suites
            </Button>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
                <Input
                    placeholder="Search chats..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Session List */}
            <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="flex flex-col gap-2 py-2">
                    <div className="text-xs font-medium text-muted-foreground px-2 mb-2">History</div>

                    {isLoading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
                        </div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground p-4">No chats found.</div>
                    ) : (
                        filteredSessions.map((session) => (
                            <Button
                                key={session.id}
                                variant={session.id === currentSessionId ? "secondary" : "ghost"}
                                className={cn(
                                    "justify-start gap-2 h-auto py-3 px-3 transition-all",
                                    session.id === currentSessionId && "bg-secondary/50 border border-border",
                                )}
                                onClick={() => onSelectSession(session.id)}
                            >
                                <MessageSquare className="h-4 w-4 shrink-0 mt-0.5"/>
                                <div className="flex flex-col items-start gap-0.5 overflow-hidden text-left w-full">
                                    <span
                                        className="truncate w-full text-sm font-medium">{session.title || "Untitled Chat"}</span>
                                    <span
                                        className="text-xs text-muted-foreground">{formatDate(session.createdAt)}</span>
                                </div>
                            </Button>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
