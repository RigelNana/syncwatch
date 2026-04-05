import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, UserCog, ChevronDown } from 'lucide-react'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { api } from '@/lib/api'

export function RoomSettings() {
  const [open, setOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)

  const ownerId = useRoomStore((s) => s.ownerId)
  const roomId = useRoomStore((s) => s.roomId)
  const users = useRoomStore((s) => s.users)
  const userId = useUserStore((s) => s.id)

  const isOwner = userId === ownerId
  if (!isOwner) return null

  const otherUsers = users.filter((u) => u.user_id !== userId)

  const handleTransfer = async (newOwnerId: string) => {
    if (!roomId || !userId) return
    setTransferring(true)
    try {
      await api.transferOwner(roomId, newOwnerId, userId)
    } catch (e) {
      console.error('Transfer failed:', e)
    } finally {
      setTransferring(false)
    }
  }

  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 hover:bg-white/5 transition-colors text-sm"
      >
        <Settings className="h-4 w-4 text-violet-400" />
        <span className="font-medium">房主设置</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          className="ml-auto"
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground">转让房主</p>
              {otherUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">暂无其他用户</p>
              ) : (
                <div className="space-y-1">
                  {otherUsers.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => handleTransfer(user.user_id)}
                      disabled={transferring}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-sm disabled:opacity-50"
                    >
                      <UserCog className="h-4 w-4 text-muted-foreground" />
                      <span>{user.nickname}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
