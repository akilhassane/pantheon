'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SearchModalProps, SearchResult } from '@/types/sidebar'

export default function SearchModal({
  isOpen,
  onClose,
  sessions,
  onResultClick,
}: SearchModalProps) {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    // Simple search implementation
    const searchResults: SearchResult[] = []
    sessions.forEach((session) => {
      session.chatHistory.forEach((message, index) => {
        if (message.content.toLowerCase().includes(query.toLowerCase())) {
          searchResults.push({
            sessionId: session.id,
            sessionName: session.name,
            messageIndex: index,
            messageRole: message.role,
            messageContent: message.content,
            matchedText: query,
            contextBefore: '',
            contextAfter: '',
            timestamp: message.timestamp || new Date(),
            relevanceScore: 1,
          })
        }
      })
    })

    setResults(searchResults)
  }, [query, sessions])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <div className="flex items-center gap-2 border-b pb-3">
          <Search className="h-5 w-5" />
          <Input
            placeholder="Search sessions, messages, commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="border-0 focus-visible:ring-0"
          />
        </div>

        <ScrollArea className="h-96">
          {results.length === 0 && query && (
            <div className="p-4 text-center text-muted-foreground">
              No results found
            </div>
          )}
          {results.map((result, i) => (
            <div
              key={i}
              className="p-3 hover:bg-accent cursor-pointer rounded-md"
              onClick={() => {
                onResultClick(result.sessionId, result.messageIndex)
                onClose()
              }}
            >
              <div className="font-medium">{result.sessionName}</div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {result.messageContent}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {result.timestamp.toLocaleString()}
              </div>
            </div>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
