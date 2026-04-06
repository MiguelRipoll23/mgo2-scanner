# mgo2-scanner

A real-time network packet scanner and spoof tool for MGO2 (Metal Gear Online 2), built with Node.js and a Dear ImGui frontend rendered in the browser via WebGL2.

![Screenshot](screenshot.png)

## Features

- **Live packet capture** — intercepts TCP traffic between the MGO2 client and server across all game ports (5731–5734, 5738)
- **Packet inspector** — hex dump viewer with ASCII side-by-side, byte-level cursor navigation, and a multi-type data inspector (uint8/16/32/float/string)
- **Packet spoofing** — create persistent spoof rules per command ID and direction (IN/OUT) that replace payloads on the fly
- **Packet exclusion** — hide specific command types from the capture list to reduce noise
- **Hex search** — search across the selected packet's payload by string, hex, uint8/16/32 value with next/prev navigation
- **Packet editing** — edit payload bytes directly in hex or ASCII view; export or copy the full raw packet
- **Auto-scroll toggle** — keep the list pinned to the latest packet or lock scroll position while browsing
- **DNS + HTTP proxy** — redirects MGO2 DNS queries and HTTP traffic to the local server transparently
- **WebSocket UI** — all state (packets, rules, spoofing toggle) synced in real time between the Node.js backend and the browser frontend

## Usage

```bash
npm install
node src/main.js        # requires Administrator for ports 53 and 80
```

The web UI opens automatically at `http://127.0.0.1:8080`.

Set `DISABLE_DNS=true` to skip the DNS server (e.g. if port 53 is already in use).
