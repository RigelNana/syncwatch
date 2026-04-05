FROM rust:1.88-bookworm AS builder

RUN mkdir -p /usr/local/cargo/ && \
    echo '[source.crates-io]\nreplace-with = "ustc"\n[source.ustc]\nregistry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"' > /usr/local/cargo/config.toml

WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    python3 \
    python3-pip \
    ffmpeg \
    && pip3 install --break-system-packages -i https://mirrors.aliyun.com/pypi/simple/ yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/syncwatch-backend /app/syncwatch-backend

RUN mkdir -p /app/videos

EXPOSE 8080

CMD ["./syncwatch-backend"]
