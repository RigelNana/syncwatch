const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || 'Request failed')
  }

  return res.json()
}

export interface LoginResponse {
  token: string
  user: {
    id: string
    nickname: string
    avatar_color: string
  }
}

export interface RoomResponse {
  id: string
  name: string
  owner_id: string
  video_url: string | null
  status: string
  video: {
    id: string
    title: string | null
    status: string
    download_progress: number | null
    duration: number | null
  } | null
  created_at: string
}

export const api = {
  login: (nickname: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    }),

  createRoom: (name: string, videoUrl: string, userId: string) =>
    request<RoomResponse>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, video_url: videoUrl, user_id: userId }),
    }),

  getRoom: (roomId: string) =>
    request<RoomResponse>(`/api/rooms/${roomId}`),

  transferOwner: (roomId: string, newOwnerId: string, requesterId: string) =>
    request<{ ok: boolean }>(`/api/rooms/${roomId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ new_owner_id: newOwnerId, requester_id: requesterId }),
    }),

  getStreamUrl: (videoId: string) =>
    `${API_BASE}/api/stream/${videoId}`,
}
