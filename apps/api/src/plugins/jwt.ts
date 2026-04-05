import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from '../lib/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default fp(async (app) => {
  // Try to load RS256 keys, fall back to HS256 for development without keys
  const privateKeyPath = path.resolve(__dirname, '../../keys/private.pem')
  const publicKeyPath  = path.resolve(__dirname, '../../keys/public.pem')

  let jwtOptions: Parameters<typeof jwt>[1]

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8')
    const publicKey  = fs.readFileSync(publicKeyPath, 'utf8')
    jwtOptions = {
      secret: { private: privateKey, public: publicKey },
      sign:   { algorithm: 'RS256', expiresIn: '15m' },
      verify: { algorithms: ['RS256'] },
    }
    app.log.info('JWT: using RS256 key pair')
  } else {
    // Fallback for CI / environments without key files
    app.log.warn('JWT: RS256 keys not found, falling back to HS256 (development only)')
    jwtOptions = {
      secret: env.COOKIE_SECRET,
      sign:   { expiresIn: '15m' },
      verify: { },
    }
  }

  await app.register(jwt, jwtOptions)
})
