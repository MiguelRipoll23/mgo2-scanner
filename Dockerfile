FROM node:24.14.1-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# DNS (UDP), HTTP proxy, TCP proxy range, Web GUI
EXPOSE 53/udp
EXPOSE 80/tcp
EXPOSE 5731/tcp 5732/tcp 5733/tcp 5734/tcp 5738/tcp 5739/tcp
EXPOSE 8080/tcp

ENV LISTENING_IP=0.0.0.0
ENV DNS_UPSTREAM_IP=8.8.8.8
ENV DNS_UPSTREAM_PORT=53

CMD ["node", "src/main.js"]
