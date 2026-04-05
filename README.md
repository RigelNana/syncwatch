# SyncWatch - 多人同步观影平台

实时同步播放视频的多人在线观影平台，支持 YouTube / Bilibili 等平台视频。

## 技术栈

| 层 | 技术 |
|---|------|
| **前端** | React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui + Zustand + TanStack Query + React Router + Framer Motion |
| **后端** | Rust + Axum + SeaORM + PostgreSQL + Redis |
| **视频处理** | yt-dlp + ffprobe |
| **部署** | Docker Compose + Nginx |

## 功能特性

- **视频同步播放**：播放/暂停/进度跳转/倍速调整全房间实时同步
- **视频下载**：后端通过 yt-dlp 下载视频，支持进度实时展示
- **HTTP Range 流式分发**：支持断点续传的视频流服务
- **WebSocket 实时通信**：全房间状态广播
- **聊天室**：房间内实时聊天
- **弹幕**：支持多颜色弹幕
- **房主管理**：房主可转让、设置面板
- **暗色模式**：深色优先，支持切换
- **响应式设计**：移动端完美适配
- **房间自动清理**：超过24小时无活动自动清理
- **防刷限流**：Nginx 层面限制创建房间频率

## 同步策略

1. 前端每 500ms 通过 WebSocket 发送心跳（当前播放进度）
2. 用户操作（播放/暂停/seek/倍速）立即通过 WebSocket 广播
3. 服务端采用「最后一次操作胜出」+ 时间戳校验的并发控制
4. 客户端收到同步状态后，误差 < 200ms 视为正常不做调整
5. 操作发起者跳过自身广播，避免抖动

## 快速开始

### 前置要求

- Docker & Docker Compose
- 或者本地开发需要：
  - Rust 1.77+
  - Node.js 20+
  - PostgreSQL 16
  - Redis 7
  - yt-dlp
  - ffmpeg / ffprobe

### Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone <repo-url>
cd multiplayer_video

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET 为随机字符串

# 3. 启动所有服务
docker-compose up -d

# 4. 访问
# http://localhost
```

### 本地开发

#### 后端

```bash
# 启动 PostgreSQL 和 Redis（可用 docker）
docker-compose up -d postgres redis

# 进入后端目录
cd backend

# 安装 yt-dlp
pip install yt-dlp

# 运行
cargo run
# 后端监听 http://localhost:8080
```

#### 前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器（自动代理 API 到 backend）
npm run dev
# 前端访问 http://localhost:3000
```

## 项目结构

```
multiplayer_video/
├── backend/
│   ├── Cargo.toml
│   ├── Dockerfile
│   ├── migration/              # SeaORM 数据库迁移
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── m20240101_000001_create_users.rs
│   │       ├── m20240101_000002_create_rooms.rs
│   │       ├── m20240101_000003_create_videos.rs
│   │       └── m20240101_000004_create_messages.rs
│   └── src/
│       ├── main.rs             # 入口 + 路由注册 + 房间清理任务
│       ├── config.rs           # 环境变量配置
│       ├── error.rs            # 统一错误处理
│       ├── entities/           # SeaORM 实体
│       │   ├── user.rs
│       │   ├── room.rs
│       │   ├── video.rs
│       │   └── message.rs
│       ├── routes/
│       │   ├── auth.rs         # JWT 登录（匿名）
│       │   ├── room.rs         # 房间 CRUD
│       │   ├── stream.rs       # HTTP Range 视频流
│       │   └── ws.rs           # WebSocket 同步
│       └── services/
│           ├── download.rs     # yt-dlp 下载管理
│           └── room_manager.rs # 房间状态 + 同步协议
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css           # TailwindCSS + 毛玻璃样式
│       ├── lib/
│       │   ├── api.ts          # REST API 封装
│       │   ├── ws.ts           # WebSocket 协议定义
│       │   └── utils.ts
│       ├── stores/             # Zustand 状态管理
│       │   ├── user.ts
│       │   ├── room.ts
│       │   └── theme.ts
│       ├── hooks/
│       │   ├── useWebSocket.ts # WebSocket 连接管理
│       │   └── useVideoSync.ts # 视频同步逻辑
│       ├── components/
│       │   ├── ui/             # shadcn/ui 基础组件
│       │   ├── VideoPlayer.tsx # 自定义视频播放器
│       │   ├── ChatRoom.tsx    # 聊天室
│       │   ├── UserList.tsx    # 在线用户列表
│       │   ├── RoomSettings.tsx# 房主设置面板
│       │   ├── Danmaku.tsx     # 弹幕层
│       │   ├── DanmakuInput.tsx# 弹幕输入
│       │   ├── DownloadProgress.tsx
│       │   ├── SkeletonLoader.tsx
│       │   └── ThemeToggle.tsx
│       └── pages/
│           ├── Home.tsx        # 首页：创建房间
│           └── Room.tsx        # 房间页：视频+聊天+用户
├── nginx/
│   └── nginx.conf              # Nginx 反向代理 + 限流
├── docker-compose.yml
├── .env.example
└── README.md
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 匿名登录，获取 JWT |
| POST | `/api/rooms` | 创建房间 + 开始下载视频 |
| GET | `/api/rooms/:id` | 获取房间信息 |
| POST | `/api/rooms/:id/transfer` | 转让房主 |
| GET | `/api/stream/:video_id` | 视频流（支持 Range） |
| WS | `/ws/room/:room_id?token=xxx` | 实时同步 WebSocket |

## WebSocket 消息协议

### 客户端 → 服务端

```json
{ "type": "Play",      "data": { "timestamp": 12.5, "at": 1700000000000 } }
{ "type": "Pause",     "data": { "timestamp": 12.5, "at": 1700000000000 } }
{ "type": "Seek",      "data": { "timestamp": 30.0, "at": 1700000000000 } }
{ "type": "Speed",     "data": { "rate": 1.5, "at": 1700000000000 } }
{ "type": "Heartbeat", "data": { "timestamp": 12.5 } }
{ "type": "Chat",      "data": { "content": "你好" } }
{ "type": "Danmaku",   "data": { "content": "哈哈", "color": "#ffffff" } }
```

### 服务端 → 客户端

```json
{ "type": "Sync",             "data": { "playing": true, "timestamp": 12.5, "speed": 1.0, "updated_at": ..., "updated_by": "..." } }
{ "type": "ChatMessage",      "data": { "id": "...", "user_id": "...", "nickname": "...", "content": "...", ... } }
{ "type": "DanmakuMessage",   "data": { "id": "...", "content": "...", "color": "#fff", ... } }
{ "type": "UserJoined",       "data": { "user_id": "...", "nickname": "...", ... } }
{ "type": "UserLeft",         "data": { "user_id": "..." } }
{ "type": "DownloadProgress", "data": { "video_id": "...", "progress": 45.2, "status": "downloading" } }
{ "type": "RoomUpdate",       "data": { "owner_id": "...", "status": "active" } }
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | - |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379` |
| `JWT_SECRET` | JWT 签名密钥 | - |
| `SERVER_HOST` | 后端监听地址 | `0.0.0.0` |
| `SERVER_PORT` | 后端监听端口 | `8080` |
| `VIDEO_STORAGE_PATH` | 视频存储路径 | `./videos` |
| `MAX_ROOM_IDLE_HOURS` | 房间最大空闲小时数 | `24` |
| `MAX_CONCURRENT_DOWNLOADS` | 最大并发下载数 | `3` |

## License

MIT
