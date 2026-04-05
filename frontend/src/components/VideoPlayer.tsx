import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
} from 'lucide-react'
import { useRoomStore } from '@/stores/room'
import { api } from '@/lib/api'
import { useVideoSync } from '@/hooks/useVideoSync'
import { DownloadProgress } from './DownloadProgress'
import { SkeletonLoader } from './SkeletonLoader'
import { Danmaku } from './Danmaku'

interface VideoPlayerProps {
  send: (type: string, data: Record<string, unknown>) => void
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function VideoPlayer({ send }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

  const videoId = useRoomStore((s) => s.videoId)
  const videoStatus = useRoomStore((s) => s.videoStatus)
  const downloadProgress = useRoomStore((s) => s.downloadProgress)
  const syncState = useRoomStore((s) => s.syncState)

  const { handlePlay, handlePause, handleSeek, handleSpeedChange } =
    useVideoSync(videoRef, send)

  const streamUrl = videoId ? api.getStreamUrl(videoId) : null

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().then(handlePlay).catch(() => {})
    } else {
      video.pause()
      handlePause()
    }
  }, [handlePlay, handlePause])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const val = parseFloat(e.target.value)
    video.volume = val
    setVolume(val)
    if (val === 0) {
      video.muted = true
      setMuted(true)
    } else if (video.muted) {
      video.muted = false
      setMuted(false)
    }
  }, [])

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current
      if (!video || !duration) return
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = (e.clientX - rect.left) / rect.width
      video.currentTime = pct * duration
      handleSeek()
    },
    [duration, handleSeek]
  )

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (videoStatus !== 'ready') {
    if (videoStatus === 'pending' || videoStatus === 'downloading') {
      return <DownloadProgress progress={downloadProgress} status={videoStatus} />
    }
    if (videoStatus === 'error') {
      return <DownloadProgress progress={0} status="error" />
    }
    return <SkeletonLoader />
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black/80 group"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={streamUrl || undefined}
        className="w-full h-full object-contain"
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
        }}
        onDurationChange={() => {
          if (videoRef.current) setDuration(videoRef.current.duration)
        }}
        onLoadedData={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onClick={togglePlay}
        playsInline
      />

      {/* Danmaku overlay */}
      <Danmaku />

      {/* Loading spinner */}
      <AnimatePresence>
        {isLoading && streamUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-12 h-12 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Big play button when paused */}
      <AnimatePresence>
        {syncState.playing === false && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center">
              <Play className="h-8 w-8 text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-4 px-4"
          >
            {/* Progress bar */}
            <div
              className="w-full h-1.5 rounded-full bg-white/20 cursor-pointer mb-4 group/progress hover:h-2.5 transition-all"
              onClick={handleProgressClick}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 relative"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Bottom controls */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  {syncState.playing ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </button>

                <div className="flex items-center gap-2 group/vol">
                  <button
                    onClick={toggleMute}
                    className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-0 group-hover/vol:w-20 transition-all duration-300 accent-violet-500 h-1"
                  />
                </div>

                <span className="text-xs text-white/70 font-mono tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Speed selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="h-9 px-3 rounded-lg hover:bg-white/10 flex items-center gap-1.5 transition-colors text-xs font-medium"
                  >
                    <Gauge className="h-4 w-4" />
                    {syncState.speed}x
                  </button>
                  <AnimatePresence>
                    {showSpeedMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute bottom-full right-0 mb-2 py-1 rounded-xl glass-strong min-w-[80px]"
                      >
                        {SPEED_OPTIONS.map((speed) => (
                          <button
                            key={speed}
                            onClick={() => {
                              handleSpeedChange(speed)
                              setShowSpeedMenu(false)
                            }}
                            className={`w-full px-4 py-1.5 text-xs text-left hover:bg-white/10 transition-colors ${
                              syncState.speed === speed
                                ? 'text-violet-400'
                                : 'text-white/70'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
