import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Play,
  Link2,
  Sparkles,
  Users,
  Zap,
  Shield,
  ArrowRight,
  Tv,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useUserStore } from '@/stores/user'
import { api } from '@/lib/api'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
}

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}

export function Home() {
  const navigate = useNavigate()
  const [videoUrl, setVideoUrl] = useState('')
  const [roomName, setRoomName] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const user = useUserStore()

  const handleCreate = async () => {
    setError('')
    if (!videoUrl.trim()) {
      setError('请输入视频链接')
      return
    }

    setLoading(true)
    try {
      // Login if needed
      let userId = user.id
      if (!userId) {
        const nick = nickname.trim() || `用户${Math.floor(Math.random() * 9999)}`
        const res = await api.login(nick)
        user.setUser(res.user, res.token)
        userId = res.user.id
      }

      const name = roomName.trim() || '观影房间'
      const room = await api.createRoom(name, videoUrl.trim(), userId)
      navigate(`/room/${room.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建房间失败')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Zap, title: '实时同步', desc: '播放/暂停/进度/倍速全房间同步' },
    { icon: Users, title: '多人观影', desc: '邀请好友一起看，聊天互动' },
    { icon: Shield, title: '安全播放', desc: '视频通过服务器中转，安全可靠' },
    { icon: Sparkles, title: '弹幕互动', desc: '发送弹幕，让观影更有趣' },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-fuchsia-600/8 blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-blue-600/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Tv className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">SyncWatch</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 pt-12 pb-24 md:pt-24">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-16"
        >
          {/* Hero */}
          <div className="text-center space-y-6">
            <motion.div variants={item}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium glass text-violet-300">
                <Sparkles className="h-3 w-3" />
                多人同步观影平台
              </span>
            </motion.div>

            <motion.h1
              variants={item}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]"
            >
              与好友一起
              <br />
              <span className="text-gradient">同步看视频</span>
            </motion.h1>

            <motion.p
              variants={item}
              className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed"
            >
              粘贴 YouTube / Bilibili 等平台的视频链接，创建房间，
              邀请好友一起同步观看，实时聊天互动。
            </motion.p>
          </div>

          {/* Create room form */}
          <motion.div variants={item} className="max-w-lg mx-auto">
            <div className="glass-strong rounded-3xl p-8 space-y-5 glow-primary">
              {!user.id && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    你的昵称
                  </label>
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="输入昵称（可留空）"
                    maxLength={32}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  视频链接
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="粘贴 YouTube / Bilibili 视频链接"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  房间名称
                </label>
                <Input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="给房间起个名字（可留空）"
                  maxLength={128}
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-400"
                >
                  {error}
                </motion.p>
              )}

              <Button
                onClick={handleCreate}
                disabled={loading}
                size="lg"
                className="w-full text-base gap-2"
              >
                {loading ? (
                  <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    创建房间
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Features */}
          <motion.div
            variants={item}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {features.map((feat) => (
              <div
                key={feat.title}
                className="glass rounded-2xl p-5 space-y-3 glass-hover group"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                  <feat.icon className="h-5 w-5 text-violet-400" />
                </div>
                <h3 className="text-sm font-semibold">{feat.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
