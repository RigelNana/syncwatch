import { useState } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { MessageSquareText } from 'lucide-react'

interface DanmakuInputProps {
  send: (type: string, data: Record<string, unknown>) => void
}

const COLORS = ['#ffffff', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6']

export function DanmakuInput({ send }: DanmakuInputProps) {
  const [text, setText] = useState('')
  const [color, setColor] = useState('#ffffff')

  const handleSend = () => {
    const content = text.trim()
    if (!content) return
    send('Danmaku', { content, color })
    setText('')
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-white/5">
      <div className="flex gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-4 h-4 rounded-full transition-all ${
              color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-background scale-110' : 'opacity-60 hover:opacity-100'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder="发送弹幕..."
        className="flex-1 h-8 text-xs rounded-lg"
        maxLength={100}
      />
      <Button size="sm" onClick={handleSend} disabled={!text.trim()} className="h-8 px-3 rounded-lg">
        <MessageSquareText className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
