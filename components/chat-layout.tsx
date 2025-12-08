"use client"

import * as React from "react"
import { Sidebar } from "@/components/sidebar"
import { ChatArea } from "@/components/chat-area"
import { DocumentPanel } from "@/components/document-panel"
import { TestSuitePage } from "@/components/test-suite/test-suite-page"
import { cn } from "@/lib/utils"

export function ChatLayout() {
  const [isRightPanelOpen, setIsRightPanelOpen] = React.useState(true)
  const [currentSessionId, setCurrentSessionId] = React.useState<string | undefined>(undefined)
  const [currentView, setCurrentView] = React.useState<"chat" | "test-suites">("chat")

  const toggleRightPanel = () => {
    setIsRightPanelOpen(!isRightPanelOpen)
  }

  if (currentView === "test-suites") {
    return <TestSuitePage onBack={() => setCurrentView("chat")} />
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* 1. Linke Sidebar */}
      <div className="hidden md:flex md:w-[260px] border-r bg-sidebar flex-col shrink-0 h-full">
        <Sidebar
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onNewChat={() => setCurrentSessionId(undefined)}
          onOpenTestSuites={() => setCurrentView("test-suites")}
        />
      </div>

      {/* 2. Mittlerer Bereich (Chat) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-background relative">
        <ChatArea
          isRightPanelOpen={isRightPanelOpen}
          toggleRightPanel={toggleRightPanel}
          initialSessionId={currentSessionId}
          onSessionCreated={setCurrentSessionId}
        />
      </main>

      {/* 3. Rechte Sidebar (Dokumente) */}
      <div
        className={cn(
          "border-l bg-sidebar transition-all duration-300 ease-in-out flex flex-col h-full",
          isRightPanelOpen ? "w-[300px]" : "w-0 border-l-0",
        )}
      >
        <div className={cn("w-[300px] h-full overflow-hidden", !isRightPanelOpen && "hidden")}>
          <DocumentPanel />
        </div>
      </div>
    </div>
  )
}
