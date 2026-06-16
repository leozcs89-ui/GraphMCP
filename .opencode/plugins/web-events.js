import { WebSocket } from "ws"

export const WebEventsPlugin = async ({ client }) => {
  let ws = null
  let reconnectTimer = null

  const connect = () => {
    try {
      ws = new WebSocket("ws://localhost:3001")
    } catch (e) {
      console.error("[web-events] Create fail:", e.message)
      reconnectTimer = setTimeout(connect, 3000)
      return
    }

    ws.on("open", () => {
      console.log("[web-events] Connected to graphMCP")
    })

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.type === "user_event" && msg.message) {
          client.session.prompt({ body: msg.message })
        }
      } catch (e) {
        console.error("[web-events] Parse fail:", e.message)
      }
    })

    ws.on("close", () => {
      console.log("[web-events] Closed, reconnect in 3s")
      reconnectTimer = setTimeout(connect, 3000)
    })

    ws.on("error", (e) => {
      console.error("[web-events] Error:", e.message)
      ws?.close()
    })
  }

  connect()
  return {}
}
