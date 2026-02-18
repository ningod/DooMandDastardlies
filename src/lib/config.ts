/**
 * Legal and contact configuration.
 *
 * Values are read from environment variables at startup so they can be
 * injected at deploy-time without touching source code. Each variable falls
 * back to the canonical GitHub URL when not set, so the bot works correctly
 * out of the box without requiring any extra configuration.
 */

const GITHUB_BASE = 'https://github.com/ningod/DooMandDastardlies/blob/main';

export const config = {
  /** Public URL for the Terms of Service document. */
  termsUrl: process.env.TERMS_OF_SERVICE_URL ?? `${GITHUB_BASE}/TERMS.md`,

  /** Public URL for the Privacy Policy document. */
  privacyUrl: process.env.PRIVACY_POLICY_URL ?? `${GITHUB_BASE}/PRIVACY.md`,

  /** Invite link to a support server, if configured. */
  supportServerLink: process.env.SUPPORT_SERVER_LINK ?? null,

  /** Developer contact email for GDPR/privacy requests, if configured. */
  developerContactEmail: process.env.DEVELOPER_CONTACT_EMAIL ?? null,
} as const;
