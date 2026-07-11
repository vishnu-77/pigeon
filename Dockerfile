FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY examples ./examples
COPY docs ./docs
COPY README.md ./

EXPOSE 8787

CMD ["node", "--preserve-symlinks", "--preserve-symlinks-main", "src/server.js"]
