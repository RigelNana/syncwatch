export interface WsMessage {
  type: string
  data: unknown
}

export interface SyncState {
  playing: boolean
  timestamp: number
  speed: number
  updated_at: number
  updated_by: string
}

export interface ChatMsg {
  id: string
  user_id: string
  nickname: string
  avatar_color: string
  content: string
  created_at: number
}

export interface DanmakuMsg {
  id: string
  user_id: string
  content: string
  color: string
  timestamp: number
}

export interface RoomUser {
  user_id: string
  nickname: string
  avatar_color: string
  joined_at: number
}

export type ServerMessage =
  | { type: 'Sync'; data: SyncState }
  | { type: 'ChatMessage'; data: ChatMsg }
  | { type: 'DanmakuMessage'; data: DanmakuMsg }
  | { type: 'UserJoined'; data: RoomUser }
  | { type: 'UserLeft'; data: { user_id: string } }
  | { type: 'DownloadProgress'; data: { video_id: string; progress: number; status: string } }
  | { type: 'RoomUpdate'; data: { owner_id: string; status: string } }
  | { type: 'Error'; data: { message: string } }

export function createWsUrl(roomId: string, token: string): string {
  const wsBase = import.meta.env.VITE_WS_BASE_URL || `ws://${window.location.host}`
  return `${wsBase}/ws/room/${roomId}?token=${encodeURIComponent(token)}`
}

export function sendWsMessage(ws: WebSocket, type: string, data: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }))
  }
}
