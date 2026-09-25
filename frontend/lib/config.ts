/** Backend address. Set NEXT_PUBLIC_API_URL in .env.local (dev) or in Vercel (production). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

/** Same host, with ws:// or wss:// for the live meeting connection. */
export const WS_URL = API_URL.replace(/^http/, "ws");

/**
 * STUN/TURN servers for WebRTC. STUN is enough on most networks; for strict corporate/mobile networks
 * set NEXT_PUBLIC_ICE_SERVERS to a JSON array including a TURN server, e.g.
 * [{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
 */
export const ICE_SERVERS: RTCIceServer[] = (() => {
  try {
    if (process.env.NEXT_PUBLIC_ICE_SERVERS) return JSON.parse(process.env.NEXT_PUBLIC_ICE_SERVERS);
  } catch {
    console.warn("NEXT_PUBLIC_ICE_SERVERS is not valid JSON; using public STUN");
  }
  return [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
})();
