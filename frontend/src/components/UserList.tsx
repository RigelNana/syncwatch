import { motion, AnimatePresence } from 'framer-motion'
import { Users, Crown } from 'lucide-react'
import { useRoomStore } from '@/stores/room'

export function UserList() {
  const users = useRoomStore((s) => s.users)
  const ownerId = useRoomStore((s) => s.ownerId)

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Users className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium">在线用户</span>
        <span className="ml-auto text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-white/5">
          {users.length}
        </span>
      </div>
      <div className="p-3 space-y-1">
        <AnimatePresence>
          {users.map((user) => (
            <motion.div
              key={user.user_id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="relative">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: user.avatar_color }}
                >
                  {user.nickname[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
              </div>
              <span className="text-sm truncate flex-1">{user.nickname}</span>
              {user.user_id === ownerId && (
                <Crown className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
