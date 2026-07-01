FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["npm", "start"]
