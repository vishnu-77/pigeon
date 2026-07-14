FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY examples ./examples
COPY docs ./docs
COPY README.md ./

# Durable state directory, owned by the unprivileged node user (FND-05/08).
RUN mkdir -p /data && chown -R node:node /data
ENV PIGEON_DATA_DIR=/data
VOLUME ["/data"]

# Run as the built-in unprivileged user, not root (FND-08).
USER node

EXPOSE 8787

# Container-level liveness probe (compose has its own; this covers plain docker run).
HEALTHCHECK --interval=5s --timeout=3s --start-period=2s --retries=10 \
  CMD node -e "fetch('http://localhost:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--preserve-symlinks", "--preserve-symlinks-main", "src/server.js"]
