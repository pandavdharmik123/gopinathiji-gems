// Optional self-pinger to keep a Render service awake.
//
// Disabled by default. Render bills free web services by instance-hour and
// spins them down after 15 minutes of inactivity; self-pinging every 5 minutes
// keeps the service running 24/7, which defeats Render's cost model.
//
// Enable only if you deliberately want an always-on instance:
//   KEEP_ALIVE_ENABLED=true
import { env } from '../config/env'

const PING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function startKeepAlive(): void {
  if (!env.KEEP_ALIVE_ENABLED) {
    console.log('ℹ️  KeepAlive: disabled (set KEEP_ALIVE_ENABLED=true to enable)')
    return
  }

  const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL

  if (!baseUrl) {
    console.log('ℹ️  KeepAlive: No RENDER_EXTERNAL_URL or SERVER_URL set — skipping keep-alive pinger.')
    return
  }

  const targetUrl = `${baseUrl.replace(/\/$/, '')}/health`

  console.log(`🏓 KeepAlive: Pinging ${targetUrl} every 5 minutes`)

  setInterval(async () => {
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'KeepAlive-Service/1.0',
        },
      })

      if (response.ok) {
        console.log(`✅ KeepAlive: Ping succeeded (${response.status}) at ${new Date().toISOString()}`)
      } else {
        console.warn(`⚠️  KeepAlive: Ping returned non-200 status ${response.status} at ${new Date().toISOString()}`)
      }
    } catch (err) {
      console.warn(`⚠️  KeepAlive: Ping failed at ${new Date().toISOString()}:`, err)
    }
  }, PING_INTERVAL_MS)
}
