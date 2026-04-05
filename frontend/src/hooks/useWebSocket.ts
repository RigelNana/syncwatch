import { useEffect, useRef, useCallback } from 'react'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { createWsUrl, type ServerMessage } from '@/lib/ws'

export function useWebSocket(roomId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const token = useUserStore((s) => s.token)
  const {
    setSyncState,
    addUser,
    removeUser,
    addMessage,
    addDanmaku,
    setOwner,
    setDownloadProgress,
  } = useRoomStore()

  const connect = useCallback(() => {
    if (!roomId || !token) return

    const url = createWsUrl(roomId, token)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected to room', roomId)
    }

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)
        switch (msg.type) {
          case 'Sync':
            setSyncState(msg.data)
            break
          case 'ChatMessage':
            addMessage(msg.data)
            break
          case 'DanmakuMessage':
            addDanmaku(msg.data)
            break
          case 'UserJoined':
            addUser(msg.data)
            break
          case 'UserLeft':
            removeUser(msg.data.user_id)
            break
          case 'DownloadProgress':
            setDownloadProgress(msg.data.progress, msg.data.status)
            break
          case 'RoomUpdate':
            setOwner(msg.data.owner_id)
            break
          case 'Error':
            console.error('[WS] Server error:', msg.data.message)
            break
        }
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 2s...')
      reconnectTimer.current = setTimeout(connect, 2000)
    }

    ws.onerror = (e) => {
      console.error('[WS] Error:', e)
      ws.close()
    }
  }, [roomId, token, setSyncState, addUser, removeUser, addMessage, addDanmaku, setOwner, setDownloadProgress])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((type: string, data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }))
    }
  }, [])

  return { ws: wsRef, send }
}
