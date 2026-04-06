FROM docker.1ms.run/rust:1.88-bookworm AS builder

WORKDIR /app
COPY . .
RUN cargo build --release

FROM docker.1ms.run/debian:bookworm-slim

RUN sed -i 's|deb.debian.org|mirrors.ustc.edu.cn|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    python3 \
    python3-pip \
    ffmpeg \
    && pip3 install --break-system-packages --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/syncwatch-backend /app/syncwatch-backend

RUN mkdir -p /app/videos

EXPOSE 8080

CMD ["./syncwatch-backend"]
