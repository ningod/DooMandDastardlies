import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { verifyDiscordSignature } from '../src/http/verify.js';

const subtle = webcrypto.subtle;

/** Generate an Ed25519 key pair and return the public key as hex. */
async function generateTestKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKeyHex: string;
}> {
  const keyPair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const rawPublicKey = await subtle.exportKey('raw', keyPair.publicKey as CryptoKey);
  const publicKeyHex = Buffer.from(rawPublicKey).toString('hex');
  return { privateKey: keyPair.privateKey as CryptoKey, publicKeyHex };
}

/** Sign a message with Ed25519 and return the signature as hex. */
async function signMessage(
  privateKey: CryptoKey,
  timestamp: string,
  body: string
): Promise<string> {
  const message = Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]);
  const signature = await subtle.sign('Ed25519', privateKey, message);
  return Buffer.from(signature).toString('hex');
}

describe('verifyDiscordSignature', () => {
  it('accepts a valid signature', async () => {
    const { privateKey, publicKeyHex } = await generateTestKeyPair();
    const timestamp = '1234567890';
    const body = '{"type":1}';
    const signature = await signMessage(privateKey, timestamp, body);

    const result = await verifyDiscordSignature(body, signature, timestamp, publicKeyHex);
    expect(result).toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const { publicKeyHex } = await generateTestKeyPair();
    const timestamp = '1234567890';
    const body = '{"type":1}';
    const badSignature = '0'.repeat(128);

    const result = await verifyDiscordSignature(body, badSignature, timestamp, publicKeyHex);
    expect(result).toBe(false);
  });

  it('rejects a tampered body', async () => {
    const { privateKey, publicKeyHex } = await generateTestKeyPair();
    const timestamp = '1234567890';
    const body = '{"type":1}';
    const signature = await signMessage(privateKey, timestamp, body);

    const result = await verifyDiscordSignature(
      '{"type":2}', // tampered
      signature,
      timestamp,
      publicKeyHex
    );
    expect(result).toBe(false);
  });

  it('rejects a tampered timestamp', async () => {
    const { privateKey, publicKeyHex } = await generateTestKeyPair();
    const timestamp = '1234567890';
    const body = '{"type":1}';
    const signature = await signMessage(privateKey, timestamp, body);

    const result = await verifyDiscordSignature(
      body,
      signature,
      '9999999999', // tampered
      publicKeyHex
    );
    expect(result).toBe(false);
  });

  it('returns false for malformed signature hex', async () => {
    const { publicKeyHex } = await generateTestKeyPair();
    const result = await verifyDiscordSignature(
      '{"type":1}',
      'not-valid-hex',
      '1234567890',
      publicKeyHex
    );
    expect(result).toBe(false);
  });

  it('returns false for malformed public key', async () => {
    const { privateKey } = await generateTestKeyPair();
    const timestamp = '1234567890';
    const body = '{"type":1}';
    const signature = await signMessage(privateKey, timestamp, body);

    const result = await verifyDiscordSignature(body, signature, timestamp, 'bad-key');
    expect(result).toBe(false);
  });
});
