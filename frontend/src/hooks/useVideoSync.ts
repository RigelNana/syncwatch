import { useEffect, useRef, useCallback } from 'react'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'

const SYNC_THRESHOLD_MS = 200
const HEARTBEAT_INTERVAL_MS = 500

export function useVideoSync(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  send: (type: string, data: Record<string, unknown>) => void
) {
  const syncState = useRoomStore((s) => s.syncState)
  const userId = useUserStore((s) => s.id)
  const isLocalAction = useRef(false)
  const lastSyncTime = useRef(0)

  // Apply server sync state to video
  useEffect(() => {
    const video = videoRef.current
    if (!video || !syncState.updated_at) return

    // Skip if we caused this update
    if (syncState.updated_by === userId) {
      isLocalAction.current = false
      return
    }

    const timeDiff = Math.abs(video.currentTime - syncState.timestamp)

    if (timeDiff > SYNC_THRESHOLD_MS / 1000) {
      video.currentTime = syncState.timestamp
    }

    if (syncState.playing && video.paused) {
      video.play().catch(() => {})
    } else if (!syncState.playing && !video.paused) {
      video.pause()
    }

    if (video.playbackRate !== syncState.speed) {
      video.playbackRate = syncState.speed
    }
  }, [syncState, videoRef, userId])

  // Heartbeat: send current playback position every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current
      if (!video || video.paused) return

      send('Heartbeat', { timestamp: video.currentTime })
    }, HEARTBEAT_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [videoRef, send])

  const handlePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    isLocalAction.current = true
    send('Play', {
      timestamp: video.currentTime,
      at: Date.now(),
    })
  }, [videoRef, send])

  const handlePause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    isLocalAction.current = true
    send('Pause', {
      timestamp: video.currentTime,
      at: Date.now(),
    })
  }, [videoRef, send])

  const handleSeek = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    // Debounce seeks
    const now = Date.now()
    if (now - lastSyncTime.current < 200) return
    lastSyncTime.current = now

    isLocalAction.current = true
    send('Seek', {
      timestamp: video.currentTime,
      at: now,
    })
  }, [videoRef, send])

  const handleSpeedChange = useCallback(
    (rate: number) => {
      const video = videoRef.current
      if (!video) return
      video.playbackRate = rate
      isLocalAction.current = true
      send('Speed', {
        rate,
        at: Date.now(),
      })
    },
    [videoRef, send]
  )

  return {
    handlePlay,
    handlePause,
    handleSeek,
    handleSpeedChange,
  }
}
