import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Copy,
  Check,
  LogOut,
  Tv,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { VideoPlayer } from '@/components/VideoPlayer'
import { ChatRoom } from '@/components/ChatRoom'
import { UserList } from '@/components/UserList'
import { RoomSettings } from '@/components/RoomSettings'
import { DanmakuInput } from '@/components/DanmakuInput'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { api } from '@/lib/api'

export function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const user = useUserStore()
  const { setRoom, setVideo, reset } = useRoomStore()
  const roomName = useRoomStore((s) => s.roomName)

  // Ensure user is logged in
  useEffect(() => {
    if (!user.id) {
      const nick = `用户${Math.floor(Math.random() * 9999)}`
      api.login(nick).then((res) => {
        user.setUser(res.user, res.token)
      })
    }
  }, [user])

  // Fetch room data
  const { data: room, isLoading } = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => api.getRoom(roomId!),
    enabled: !!roomId && !!user.token,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.video?.status === 'ready') return false
      return 3000
    },
  })

  // Set room store from server data
  useEffect(() => {
    if (room) {
      setRoom(room.id, room.name, room.owner_id)
      if (room.video) {
        setVideo(room.video.id, room.video.status, room.video.download_progress ?? 0)
      }
    }
  }, [room, setRoom, setVideo])

  // WebSocket connection
  const { send } = useWebSocket(roomId)

  // Cleanup on leave
  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleLeave = () => {
    reset()
    navigate('/')
  }

  if (isLoading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
          <p className="text-sm text-muted-foreground">加载房间中...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-fuchsia-600/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 md:px-6 border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Tv className="h-4 w-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold truncate max-w-[200px]">
              {roomName || room.name}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {room.video?.title || '视频加载中...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 text-xs"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? '已复制' : '邀请链接'}
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLeave}
            className="h-9 w-9"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* Left: Video */}
        <div className="flex-1 flex flex-col min-w-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="p-3 md:p-4 flex-1 flex flex-col"
          >
            <VideoPlayer send={send} />

            {/* Danmaku input below video */}
            <div className="mt-2 glass rounded-xl overflow-hidden">
              <DanmakuInput send={send} />
            </div>
          </motion.div>
        </div>

        {/* Right: Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full lg:w-[340px] xl:w-[380px] border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col bg-background/50 backdrop-blur-sm"
        >
          {/* Users */}
          <div className="border-b border-white/5">
            <UserList />
          </div>

          {/* Chat takes remaining space */}
          <div className="flex-1 min-h-0">
            <ChatRoom send={send} />
          </div>

          {/* Room settings (owner only) */}
          <RoomSettings />
        </motion.aside>
      </div>
    </div>
  )
}
