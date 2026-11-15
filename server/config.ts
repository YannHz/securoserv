import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
// Resolve the file relative to the project, independently of the terminal's cwd.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
export function databaseConfig() {
  const required = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const
  const missing = required.filter(key => !process.env[key]?.trim())
  if (missing.length) throw new Error(`Faltan variables en .env: ${missing.join(', ')}`)
  return {
    server: process.env.DB_SERVER!, database: process.env.DB_NAME!,
    user: process.env.DB_USER!, password: process.env.DB_PASSWORD!, port: 1433,
    options: { encrypt: true, trustServerCertificate: false, appName: 'SecuroServ' },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000, requestTimeout: 15000,
  }
}
export function serverPort() {
  const port = Number(process.env.API_PORT || 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT no es válido.')
  return port
}
