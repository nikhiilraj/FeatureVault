import type { FastifyInstance } from 'fastify'
import { flagsService } from '../flags/flags.service.js'
import { authenticateSDKKey } from '../../middleware/sdk-auth.js'
import { redisSub, REDIS_KEYS } from '../../lib/redis/client.js'
import { activeWsConnections } from '../../lib/metrics.js'

const wsConnections = new Map<string, Set<any>>()

async function setupPubSubListener() {
  await redisSub.psubscribe('fv:pubsub:flags:*')
  redisSub.on('pmessage', (_pattern: string, channel: string, message: string) => {
    const projectId = channel.replace('fv:pubsub:flags:', '')
    const connections = wsConnections.get(projectId)
    if (!connections || connections.size === 0) return
    connections.forEach((ws) => {
      try {
        if (ws.readyState === 1) ws.send(message)
      } catch {
        connections.delete(ws)
      }
    })
  })
}

setupPubSubListener().catch(console.error)

export async function sdkApiRoutes(app: FastifyInstance) {

  // GET /sdk/v1/flags
  app.get('/flags', { preHandler: authenticateSDKKey }, async (request, reply) => {
    const { projectId } = request.sdkContext
    const config = await flagsService.getSDKConfig(projectId)
    return reply.status(200).send({
      success:   true,
      projectId,
      flags:     config,
      fetchedAt: new Date().toISOString(),
    })
  })

  // WS /sdk/v1/ws — must use app.get with websocket:true
  app.get('/ws', {
    websocket: true,
    preHandler: authenticateSDKKey,
  }, (socket, request) => {
    const { projectId } = request.sdkContext
    const ws = socket.socket   // underlying WebSocket

    if (!wsConnections.has(projectId)) wsConnections.set(projectId, new Set())
    wsConnections.get(projectId)!.add(ws)
    
    // Update gauge
    activeWsConnections.labels(projectId).set(wsConnections.get(projectId)!.size)

    app.log.info(`[WS] SDK connected to project ${projectId} (total: ${wsConnections.get(projectId)!.size})`)

    ws.send(JSON.stringify({
      type:       'connected',
      projectId,
      serverTime: new Date().toISOString(),
    }))

    ws.on('message', (rawMsg: Buffer) => {
      try {
        const msg = JSON.parse(rawMsg.toString())
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }))
        }
      } catch { /* ignore malformed */ }
    })

    ws.on('close', () => {
      wsConnections.get(projectId)?.delete(ws)
      activeWsConnections.labels(projectId).set(wsConnections.get(projectId)?.size ?? 0)
      app.log.info(`[WS] SDK disconnected from project ${projectId}`)
    })

    ws.on('error', () => {
      wsConnections.get(projectId)?.delete(ws)
      activeWsConnections.labels(projectId).set(wsConnections.get(projectId)?.size ?? 0)
    })
  })
}
