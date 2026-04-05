import { create } from 'zustand'
import type { ChatMsg, DanmakuMsg, RoomUser, SyncState } from '@/lib/ws'

interface RoomState {
  roomId: string | null
  roomName: string | null
  ownerId: string | null
  videoId: string | null
  videoStatus: string
  downloadProgress: number
  users: RoomUser[]
  messages: ChatMsg[]
  danmakus: DanmakuMsg[]
  syncState: SyncState

  setRoom: (roomId: string, roomName: string, ownerId: string) => void
  setVideo: (videoId: string, status: string, progress: number) => void
  setSyncState: (state: SyncState) => void
  addUser: (user: RoomUser) => void
  removeUser: (userId: string) => void
  addMessage: (msg: ChatMsg) => void
  addDanmaku: (msg: DanmakuMsg) => void
  setOwner: (ownerId: string) => void
  setDownloadProgress: (progress: number, status: string) => void
  reset: () => void
}

const initialSyncState: SyncState = {
  playing: false,
  timestamp: 0,
  speed: 1,
  updated_at: 0,
  updated_by: '',
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  roomName: null,
  ownerId: null,
  videoId: null,
  videoStatus: 'pending',
  downloadProgress: 0,
  users: [],
  messages: [],
  danmakus: [],
  syncState: initialSyncState,

  setRoom: (roomId, roomName, ownerId) =>
    set({ roomId, roomName, ownerId }),

  setVideo: (videoId, status, progress) =>
    set({ videoId, videoStatus: status, downloadProgress: progress }),

  setSyncState: (syncState) => set({ syncState }),

  addUser: (user) =>
    set((state) => {
      if (state.users.find((u) => u.user_id === user.user_id)) return state
      return { users: [...state.users, user] }
    }),

  removeUser: (userId) =>
    set((state) => ({
      users: state.users.filter((u) => u.user_id !== userId),
    })),

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages.slice(-200), msg],
    })),

  addDanmaku: (msg) =>
    set((state) => ({
      danmakus: [...state.danmakus.slice(-50), msg],
    })),

  setOwner: (ownerId) => set({ ownerId }),

  setDownloadProgress: (progress, status) =>
    set({ downloadProgress: progress, videoStatus: status }),

  reset: () =>
    set({
      roomId: null,
      roomName: null,
      ownerId: null,
      videoId: null,
      videoStatus: 'pending',
      downloadProgress: 0,
      users: [],
      messages: [],
      danmakus: [],
      syncState: initialSyncState,
    }),
}))
