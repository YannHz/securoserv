import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
function derive(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(pin, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)))
}
export const validPin = (pin: unknown): pin is string => typeof pin === 'string' && /^[1-9][0-9]{7}$/.test(pin)
export async function hashPin(pin: string) {
  if (!validPin(pin)) throw new Error('PIN no válido')
  const salt = randomBytes(16)
  return `scrypt$16384$8$1$${salt.toString('base64')}$${(await derive(pin, salt)).toString('base64')}`
}
export async function verifyPin(pin: string, encoded: string) {
  const parts = encoded.split('$')
  if (parts.length !== 6 || parts.slice(0,4).join('$') !== 'scrypt$16384$8$1') return false
  const salt = Buffer.from(parts[4], 'base64'), expected = Buffer.from(parts[5], 'base64')
  if (salt.length !== 16 || expected.length !== 64) return false
  return timingSafeEqual(await derive(pin, salt), expected)
}
