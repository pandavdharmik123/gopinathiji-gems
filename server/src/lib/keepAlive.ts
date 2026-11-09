// Pings GET /api/health every 5 minutes to prevent host sleep on Render

const PING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function startKeepAlive(): void {
  const baseUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.SERVER_URL

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

