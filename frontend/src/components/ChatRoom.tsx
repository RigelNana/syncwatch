import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MessageCircle } from 'lucide-react'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { Input } from './ui/input'
import { Button } from './ui/button'

interface ChatRoomProps {
  send: (type: string, data: Record<string, unknown>) => void
}

export function ChatRoom({ send }: ChatRoomProps) {
  const [message, setMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = useRoomStore((s) => s.messages)
  const userId = useUserStore((s) => s.id)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = message.trim()
    if (!text) return
    send('Chat', { content: text })
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <MessageCircle className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium">聊天</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {messages.length} 条消息
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.user_id === userId
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: msg.avatar_color }}
                >
                  {msg.nickname[0]?.toUpperCase()}
                </div>
                <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    {msg.nickname}
                  </p>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      isMe
                        ? 'bg-violet-600/30 text-violet-100 rounded-tr-sm'
                        : 'bg-white/5 rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1 h-9 text-sm rounded-xl"
            maxLength={1000}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim()}
            className="h-9 w-9 rounded-xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
