"use client"

import { Button } from "@/components/ui/button"
import { MessageSquare, History, FileText } from "lucide-react"
import type { ViewState } from "./chat-layout"

interface MobileNavProps {
  activeView: ViewState
  onViewChange: (view: ViewState) => void
}

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  return (
    <div className="flex items-center justify-between border-b bg-background p-2">
      <Button
        variant={activeView === "history" ? "secondary" : "ghost"}
        size="sm"
        className="flex-1 gap-2"
        onClick={() => onViewChange("history")}
      >
        <History className="h-4 w-4" />
        <span className="text-xs">History</span>
      </Button>

      <Button
        variant={activeView === "chat" ? "secondary" : "ghost"}
        size="sm"
        className="flex-1 gap-2"
        onClick={() => onViewChange("chat")}
      >
        <MessageSquare className="h-4 w-4" />
        <span className="text-xs">Chat</span>
      </Button>

      <Button
        variant={activeView === "documents" ? "secondary" : "ghost"}
        size="sm"
        className="flex-1 gap-2"
        onClick={() => onViewChange("documents")}
      >
        <FileText className="h-4 w-4" />
        <span className="text-xs">Docs</span>
      </Button>
    </div>
  )
}
