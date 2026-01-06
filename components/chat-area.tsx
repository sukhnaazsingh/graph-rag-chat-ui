"use client"

import * as React from "react"
import {Button} from "@/components/ui/button"
import {Textarea} from "@/components/ui/textarea"
import {ScrollArea} from "@/components/ui/scroll-area"
import {Bot, ChevronLeft, ChevronRight, Loader2, Send, Sparkles, User} from "lucide-react"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {cn} from "@/lib/utils"
import {fetchSessionHistory, sendChatMessage} from "@/lib/api"

interface ChatAreaProps {
    isRightPanelOpen: boolean
    toggleRightPanel: () => void
    initialSessionId?: string
    onSessionCreated?: (id: string) => void
}

interface Message {
    id: number | string
    role: "assistant" | "user"
    content: string
    timestamp: string
}

export function ChatArea({
                             isRightPanelOpen,
                             toggleRightPanel,
                             initialSessionId,
                             onSessionCreated
                         }: ChatAreaProps) {

    const [input, setInput] = React.useState("")
    const [isThinking, setIsThinking] = React.useState(false)
    const [messages, setMessages] = React.useState<Message[]>([])

    // Lokaler State für die aktive Session ID
    const [sessionId, setSessionId] = React.useState<string | undefined>(initialSessionId)
    const [strategy, setStrategy] = React.useState("fast-to-g")
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(false)

    // WICHTIG: Ref um zu tracken, ob wir die Session gerade selbst erstellt haben.
    // Das verhindert, dass der useEffect die History neu lädt und unseren lokalen State überschreibt.
    const justCreatedSessionId = React.useRef<string | null>(null)

    const scrollRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => setIsMounted(true), [])

    // Synchronisation mit Parent-Prop (initialSessionId)
    React.useEffect(() => {
        const loadHistory = async () => {
            if (initialSessionId) {
                // FALL 1: Wir haben diese Session gerade selbst durch eine Nachricht erstellt.
                // Wir laden NICHT neu, da wir die Nachrichten schon im State haben (Optimistic UI).
                if (justCreatedSessionId.current === initialSessionId) {
                    setSessionId(initialSessionId) // State synchronisieren
                    justCreatedSessionId.current = null // Flag resetten
                    return
                }

                // FALL 2: Benutzer hat eine Session aus der Sidebar ausgewählt.
                // Wir laden die History vom Server.
                setIsLoadingHistory(true)
                setSessionId(initialSessionId)
                try {
                    const data = await fetchSessionHistory(initialSessionId)
                    if (data.messages) {
                        const formattedMessages = data.messages.map((msg: any) => ({
                            id: msg.id || Date.now() + Math.random(), // Fallback ID falls Backend keine liefert
                            role: msg.role,
                            content: msg.content,
                            timestamp: new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        }))
                        setMessages(formattedMessages)
                    }
                } catch (error) {
                    console.error("Failed to load history:", error)
                    setMessages([]) // Bei Fehler leeren, statt alte Nachrichten zu zeigen
                } finally {
                    setIsLoadingHistory(false)
                }
            } else {
                // FALL 3: Neuer Chat (initialSessionId ist undefined)
                // Alles zurücksetzen.
                setSessionId(undefined)
                setMessages([])
                setIsThinking(false)
                setInput("")
                justCreatedSessionId.current = null
            }
        }
        loadHistory()
    }, [initialSessionId])

    // Autoscroll
    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollIntoView({behavior: "smooth", block: "end"})
            }
        }, 100)
        return () => clearTimeout(timeoutId)
    }, [messages, isThinking, isLoadingHistory])

    const handleSend = async () => {
        if (!input.trim()) return

        const currentInput = input
        setInput("")
        setIsThinking(true)

        // Optimistic UI Update: Nachricht sofort anzeigen
        setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'user',
            content: currentInput,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        }])

        try {
            // Nutze die lokale sessionId Variable, nicht den State direkt im Request (Closure-Safety)
            const currentSessionId = sessionId;

            const res = await sendChatMessage(currentInput, strategy, currentSessionId)

            if (res.sessionId) {
                // Wenn es eine neue Session ist oder sich die ID ändert:
                if (currentSessionId !== res.sessionId) {
                    // 1. Markieren, dass WIR diese ID erstellt haben
                    justCreatedSessionId.current = res.sessionId
                    // 2. Parent informieren (löst Re-Render mit neuer Prop aus)
                    onSessionCreated?.(res.sessionId)
                }
                // 3. Lokalen State updaten
                setSessionId(res.sessionId)
            }

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: res.answer,
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
            }])
        } catch (e) {
            console.error(e)
            setMessages(prev => [...prev, {
                id: Date.now() + 2,
                role: 'assistant',
                content: "Error: Could not connect to the backend.",
                timestamp: 'Now'
            }])
        } finally {
            setIsThinking(false)
        }
    }

    if (!isMounted) return <div className="h-full w-full bg-background"/>

    return (
        <div className="flex flex-col h-full w-full bg-background">
            {/* Header */}
            <header
                className="flex-none h-14 flex items-center justify-between border-b px-4 bg-background/95 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                    <Select value={strategy} onValueChange={setStrategy}>
                        <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="Select Strategy"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="rule-based">Rule Based</SelectItem>
                            <SelectItem value="llm-based-simple">LLM Based Simple</SelectItem>
                            <SelectItem value="llm-neurosymbolic">LLM Neuro Symbolic</SelectItem>
                            <SelectItem value="concept-template">Template Based</SelectItem>
                            <SelectItem value="fast-to-g">Fast To G</SelectItem>
                        </SelectContent>
                    </Select>
                    <div
                        className="hidden md:flex items-center text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                        <Sparkles className="mr-1 h-3 w-3 text-indigo-500"/>
                        <span>Graph Mode</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={toggleRightPanel} className="flex items-center gap-2">
                        {isRightPanelOpen ? (
                            <><span className="hidden sm:inline text-xs">Close Panel</span><ChevronRight
                                className="h-4 w-4"/></>
                        ) : (
                            <><span className="hidden sm:inline text-xs">Documents</span><ChevronLeft
                                className="h-4 w-4"/></>
                        )}
                    </Button>
                </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 min-h-0 w-full">
                <ScrollArea className="h-full w-full p-4">
                    <div className="max-w-3xl mx-auto flex flex-col gap-6 py-4">
                        {isLoadingHistory && (
                            <div className="flex justify-center items-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                            </div>
                        )}

                        {!isLoadingHistory && messages.length === 0 && (
                            <div
                                className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground gap-2">
                                <Sparkles className="h-8 w-8 text-muted-foreground/50"/>
                                <p>Start a new conversation...</p>
                            </div>
                        )}

                        {!isLoadingHistory && messages.map((m) => (
                            <div key={m.id}
                                 className={cn("flex gap-4 w-full", m.role === "user" ? "justify-end" : "justify-start")}>
                                {m.role === "assistant" && (
                                    <div
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Bot className="h-5 w-5"/>
                                    </div>
                                )}
                                <div
                                    className={cn("flex flex-col gap-1 max-w-[80%]", m.role === "user" ? "items-end" : "items-start")}>
                                    <div className={cn("rounded-2xl px-4 py-3 text-sm shadow-sm whitespace-pre-wrap",
                                        m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                                        {m.content}
                                    </div>
                                    <span
                                        className="text-[10px] text-muted-foreground px-1 opacity-70">{m.timestamp}</span>
                                </div>
                                {m.role === "user" && (
                                    <div
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                        <User className="h-5 w-5"/>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isThinking && (
                            <div className="flex gap-4 w-full justify-start">
                                <div
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Bot className="h-5 w-5"/>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground h-8">
                                    <Loader2 className="h-3 w-3 animate-spin"/> Thinking...
                                </div>
                            </div>
                        )}

                        <div ref={scrollRef}/>
                    </div>
                </ScrollArea>
            </div>

            {/* Input Area */}
            <div className="flex-none p-4 bg-background border-t z-10">
                <div
                    className="mx-auto max-w-3xl relative rounded-xl border bg-muted/30 focus-within:ring-1 focus-within:ring-ring focus-within:border-primary/50 transition-all">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything..."
                        className="min-h-[60px] w-full resize-none border-0 bg-transparent p-4 focus-visible:ring-0 shadow-none"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <div className="flex justify-end p-2">
                        <Button
                            size="sm"
                            onClick={handleSend}
                            disabled={!input.trim() || isThinking}
                            className={cn("transition-all", input.trim() ? "opacity-100" : "opacity-50")}
                        >
                            <Send className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}