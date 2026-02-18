# Deployment Notes — Legal & Privacy Configuration

This document explains how to configure the four new legal/privacy environment variables introduced
in this release and how to surface them in the Discord Developer Portal.

---

## New Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TERMS_OF_SERVICE_URL` | No | GitHub TERMS.md URL | Override URL for your Terms of Service |
| `PRIVACY_POLICY_URL` | No | GitHub PRIVACY.md URL | Override URL for your Privacy Policy |
| `SUPPORT_SERVER_LINK` | No | _(not shown)_ | Discord support server invite link |
| `DEVELOPER_CONTACT_EMAIL` | No | _(not shown)_ | Contact email for GDPR/privacy requests |

All four variables are **optional**. When not set, the bot uses the canonical GitHub URLs for
Terms and Privacy, and omits the optional fields. The bot functions correctly without any of them.

---

## Discord Developer Portal

### Step 1 — Terms of Service URL

1. Open <https://discord.com/developers/applications> and select your application.
2. Navigate to **General Information**.
3. Paste into **Terms of Service URL**:
   ```
   https://github.com/ningod/DooMandDastardlies/blob/main/TERMS.md
   ```
4. Click **Save Changes**.

### Step 2 — Privacy Policy URL

In the same **General Information** page:

1. Paste into **Privacy Policy URL**:
   ```
   https://github.com/ningod/DooMandDastardlies/blob/main/PRIVACY.md
   ```
2. Click **Save Changes**.

These URLs appear on the bot's public profile page and on the OAuth2 authorisation screen that
server administrators see when adding the bot.

---

## Platform-Specific Configuration

### Fly.io

Set secrets at runtime — they are encrypted and injected as environment variables:

```bash
# Legal URLs (only needed if overriding the GitHub defaults)
fly secrets set TERMS_OF_SERVICE_URL=https://your-domain.com/terms
fly secrets set PRIVACY_POLICY_URL=https://your-domain.com/privacy

# Optional contact fields
fly secrets set SUPPORT_SERVER_LINK=https://discord.gg/your-invite-code
fly secrets set DEVELOPER_CONTACT_EMAIL=privacy@your-domain.com
```

To verify which secrets are set (values are never shown):

```bash
fly secrets list
```

The Dockerfile does **not** bake these values in — they are injected at runtime, which is the
correct approach so sensitive values (like email addresses) don't end up in the image layer
history.

### Docker (local or self-hosted)

Pass variables at runtime with `-e` flags:

```bash
docker run \
  -e DISCORD_BOT_TOKEN=your-token \
  -e DISCORD_CLIENT_ID=your-client-id \
  -e PRIVACY_POLICY_URL=https://your-domain.com/privacy \
  -e TERMS_OF_SERVICE_URL=https://your-domain.com/terms \
  -e SUPPORT_SERVER_LINK=https://discord.gg/your-invite \
  -e DEVELOPER_CONTACT_EMAIL=privacy@your-domain.com \
  doomanddastardlies:latest
```

Or using an env file:

```bash
# .env.production (never commit this file)
DISCORD_BOT_TOKEN=your-token
DISCORD_CLIENT_ID=your-client-id
PRIVACY_POLICY_URL=https://your-domain.com/privacy
TERMS_OF_SERVICE_URL=https://your-domain.com/terms
SUPPORT_SERVER_LINK=https://discord.gg/your-invite
DEVELOPER_CONTACT_EMAIL=privacy@your-domain.com
```

```bash
docker run --env-file .env.production doomanddastardlies:latest
```

### Railway

1. Open your Railway project → **Variables** tab.
2. Add each variable with its value using the **New Variable** button.
3. Redeploy — Railway injects variables as environment variables automatically.

```
PRIVACY_POLICY_URL    = https://your-domain.com/privacy
TERMS_OF_SERVICE_URL  = https://your-domain.com/terms
SUPPORT_SERVER_LINK   = https://discord.gg/your-invite
DEVELOPER_CONTACT_EMAIL = privacy@your-domain.com
```

### Heroku

```bash
heroku config:set PRIVACY_POLICY_URL=https://your-domain.com/privacy
heroku config:set TERMS_OF_SERVICE_URL=https://your-domain.com/terms
heroku config:set SUPPORT_SERVER_LINK=https://discord.gg/your-invite
heroku config:set DEVELOPER_CONTACT_EMAIL=privacy@your-domain.com
```

### Local Development (`.env` file)

Copy `.env.example` to `.env` and uncomment the relevant lines:

```env
TERMS_OF_SERVICE_URL=https://github.com/ningod/DooMandDastardlies/blob/main/TERMS.md
PRIVACY_POLICY_URL=https://github.com/ningod/DooMandDastardlies/blob/main/PRIVACY.md
# SUPPORT_SERVER_LINK=https://discord.gg/your-invite-code
# DEVELOPER_CONTACT_EMAIL=privacy@your-domain.com
```

---

## After Changing Variables

**For Fly.io:** The machine restarts automatically when secrets change.

**For Docker:** You must restart the container.

**For Railway / Heroku:** Redeploy is triggered automatically.

None of the legal variables require re-registering slash commands (`npm run deploy-commands`).
The `/privacy` command reads them from `process.env` at handler invocation time.

---

## Slash Command Registration

After deploying a version that adds the `/privacy` command for the first time, re-run command
registration:

```bash
npm run deploy-commands
```

- With `DISCORD_GUILD_ID` set: commands register instantly for that guild.
- Without `DISCORD_GUILD_ID`: global registration can take up to 1 hour to propagate.

You only need to re-run this once per schema change (adding, removing, or renaming commands or
their options). Changing environment variables or embed content does not require re-registration.

---

## Checklist

- [ ] `TERMS_OF_SERVICE_URL` set in Discord Developer Portal → General Information
- [ ] `PRIVACY_POLICY_URL` set in Discord Developer Portal → General Information
- [ ] `/privacy` command registered (`npm run deploy-commands`)
- [ ] Optional: `SUPPORT_SERVER_LINK` and `DEVELOPER_CONTACT_EMAIL` set in your platform secrets
- [ ] `PRIVACY.md` committed and pushed to `main` branch
- [ ] `TERMS.md` committed and pushed to `main` branch
