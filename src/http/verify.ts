/**
 * Ed25519 signature verification for Discord HTTP interactions.
 *
 * Uses Node.js native SubtleCrypto — no external dependencies.
 * Discord sends X-Signature-Ed25519 and X-Signature-Timestamp headers
 * with every interaction POST. We must verify them before processing.
 */

import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;

/** Convert a hex string to an ArrayBuffer-backed Uint8Array. */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(hex, 'hex');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Verify a Discord interaction request signature.
 *
 * @param rawBody - The raw, unparsed request body string
 * @param signature - The X-Signature-Ed25519 header (hex-encoded)
 * @param timestamp - The X-Signature-Timestamp header
 * @param publicKey - The application's public key (hex-encoded)
 * @returns true if the signature is valid
 */
export async function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKey: string
): Promise<boolean> {
  try {
    const key = await subtle.importKey('raw', hexToBytes(publicKey), { name: 'Ed25519' }, false, [
      'verify',
    ]);

    const combined = Buffer.concat([Buffer.from(timestamp), Buffer.from(rawBody)]);
    const message = new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength);

    return await subtle.verify('Ed25519', key, hexToBytes(signature), message);
  } catch {
    return false;
  }
}
