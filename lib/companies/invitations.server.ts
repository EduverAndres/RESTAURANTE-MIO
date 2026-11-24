import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

/**
 * SHA-256 of an invitation token, hex. The SQL side computes the same value
 * with `encode(sha256(convert_to(p_token, 'UTF8')), 'hex')` to look a link up.
 */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * A fresh link token (24 random bytes, 32 base64url characters) and the hash
 * the database stores. The token itself is returned once, to the admin who
 * created it, and never written anywhere.
 */
export function newInvitationToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url')
  return { token, hash: hashInvitationToken(token) }
}
