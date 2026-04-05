import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRoomStore } from '@/stores/room'

export function Danmaku() {
  const danmakus = useRoomStore((s) => s.danmakus)
  const [activeDanmakus, setActiveDanmakus] = useState<
    Array<{
      id: string
      content: string
      color: string
      top: number
    }>
  >([])
  const lastProcessedRef = useRef(0)

  useEffect(() => {
    if (danmakus.length <= lastProcessedRef.current) return

    const newDanmakus = danmakus.slice(lastProcessedRef.current)
    lastProcessedRef.current = danmakus.length

    for (const d of newDanmakus) {
      const top = Math.random() * 80
      const item = { id: d.id, content: d.content, color: d.color, top }
      setActiveDanmakus((prev) => [...prev, item])

      // Remove after animation
      setTimeout(() => {
        setActiveDanmakus((prev) => prev.filter((x) => x.id !== d.id))
      }, 8000)
    }
  }, [danmakus])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <AnimatePresence>
        {activeDanmakus.map((d) => (
          <motion.div
            key={d.id}
            initial={{ x: '100vw' }}
            animate={{ x: '-100%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 8, ease: 'linear' }}
            className="absolute whitespace-nowrap text-sm font-medium"
            style={{
              top: `${d.top}%`,
              color: d.color,
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {d.content}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
