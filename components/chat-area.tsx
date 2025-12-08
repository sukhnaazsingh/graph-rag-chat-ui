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
    const [sessionId, setSessionId] = React.useState<string | undefined>(initialSessionId)
    const [strategy, setStrategy] = React.useState("rule-based-strategy")
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)
    const [isMounted, setIsMounted] = React.useState(false)

    // Refs
    const scrollRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => setIsMounted(true), [])

    React.useEffect(() => {
        const loadHistory = async () => {
            if (initialSessionId) {
                setIsLoadingHistory(true)
                setSessionId(initialSessionId)
                try {
                    const data = await fetchSessionHistory(initialSessionId)
                    if (data.messages) {
                        const formattedMessages = data.messages.map((msg: any) => ({
                            id: msg.id,
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
                } finally {
                    setIsLoadingHistory(false)
                }
            } else {
                setSessionId(undefined)
                setMessages([])
            }
        }
        loadHistory()
    }, [initialSessionId])

    // Autoscroll mit Timeout
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
        const txt = input;
        setInput("");
        setIsThinking(true);

        setMessages(p => [...p, {
            id: Date.now(),
            role: 'user',
            content: txt,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        }])

        try {
            const res = await sendChatMessage(txt, strategy, sessionId)
            if (res.sessionId) {
                setSessionId(res.sessionId)
                if (sessionId !== res.sessionId) onSessionCreated?.(res.sessionId)
            }
            setMessages(p => [...p, {
                id: Date.now() + 1,
                role: 'assistant',
                content: res.answer,
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
            }])
        } catch (e) {
            setMessages(p => [...p, {
                id: Date.now() + 2,
                role: 'assistant',
                content: "Error connecting to backend.",
                timestamp: 'Now'
            }])
        } finally {
            setIsThinking(false)
        }
    }

    if (!isMounted) return <div className="h-full w-full bg-background"/>

    return (
        // WICHTIG: h-full erzwingt die volle Höhe des Parents (main)
        <div className="flex flex-col h-full w-full bg-background">

            {/* 1. Header: flex-none damit er nicht schrumpft */}
            <header
                className="flex-none h-14 flex items-center justify-between border-b px-4 bg-background/95 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                    <Select value={strategy} onValueChange={setStrategy}>
                        <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="Select Strategy"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="rule-based-strategy">Rule Based</SelectItem>
                            <SelectItem value="llm-strategy">LLM Based</SelectItem>
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

            {/* 2. Messages: flex-1 nimmt RESTLICHEN Platz. min-h-0 erlaubt Schrumpfen -> Scrollbar erscheint! */}
            <div className="flex-1 min-h-0 w-full">
                <ScrollArea className="h-full w-full p-4">
                    <div className="max-w-3xl mx-auto flex flex-col gap-6 py-4">
                        {isLoadingHistory && (
                            <div className="flex justify-center items-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                            </div>
                        )}

                        {!isLoadingHistory && messages.length === 0 && (
                            <div className="text-center text-muted-foreground mt-10">Start asking questions...</div>
                        )}

                        {!isLoadingHistory && messages.map((m) => (
                            <div key={m.id}
                                 className={cn("flex gap-4 w-full", m.role === "user" ? "justify-end" : "justify-start")}>
                                {m.role === "assistant" && (
                                    <div
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <Bot className="h-5 w-5"/>
                                    </div>
                                )}
                                <div
                                    className={cn("flex flex-col gap-1 max-w-[80%]", m.role === "user" ? "items-end" : "items-start")}>
                                    <div className={cn("rounded-2xl px-4 py-3 text-sm shadow-sm whitespace-pre-wrap",
                                        m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                                        {m.content}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground px-1">{m.timestamp}</span>
                                </div>
                                {m.role === "user" && (
                                    <div
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                        <User className="h-5 w-5"/>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isThinking && <div className="text-xs text-muted-foreground ml-10 flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin"/> Thinking...
                        </div>}

                        {/* Scroll Anchor */}
                        <div ref={scrollRef}/>
                    </div>
                </ScrollArea>
            </div>

            {/* 3. Input: flex-none bleibt unten kleben */}
            <div className="flex-none p-4 bg-background border-t z-10">
                <div className="mx-auto max-w-3xl relative rounded-xl border bg-muted/30">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask..."
                        className="min-h-[60px] w-full resize-none border-0 bg-transparent p-4 focus-visible:ring-0"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <div className="flex justify-end p-2">
                        <Button size="sm" onClick={handleSend} disabled={!input.trim()}><Send
                            className="h-4 w-4"/></Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
