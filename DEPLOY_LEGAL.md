# Legal Deployment Guide

This document explains how to surface the [Terms of Service](./TERMS.md) to users through every
applicable channel: the Discord Developer Portal, the bot's own `/help` command, and the GitHub
repository.

---

## 1. Discord Developer Portal — Terms of Service URL

The Discord Developer Portal lets you attach a Terms of Service URL directly to your application.
This URL is shown to users on the bot's public profile page and during the server-authorisation
(OAuth2) flow.

### Steps

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and select your
   application.
2. Navigate to **General Information**.
3. Scroll to the **Terms of Service URL** field.
4. Paste the raw GitHub URL of `TERMS.md`:

   ```
   https://github.com/ningod/DooMandDastardlies/blob/main/TERMS.md
   ```

5. Click **Save Changes**.

> **Privacy Policy URL** — if you later create a dedicated `PRIVACY.md`, add it in the same section
> under **Privacy Policy URL**. Until then you can point it to the same `TERMS.md` (section 5
> covers data and privacy).

---

## 2. Bot Invite URL — Make Terms Visible at Authorisation

When a server administrator adds the bot via an OAuth2 link, Discord will display the Terms of
Service URL you configured above automatically. No additional changes are required — just ensure
step 1 above is completed before sharing the invite link.

The invite URL pattern (replace `YOUR_CLIENT_ID`) is:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=18432&scope=bot%20applications.commands
```

---

## 3. `/help` Command — In-Bot Terms Link

The `/help` command in [src/commands/help.ts](./src/commands/help.ts) is the natural place to
surface the Terms link inside Discord itself. Apply this change to the `handleHelpCommand` function:

### Change: update `embed.setFooter()`

**Before (`src/commands/help.ts`, around line 93):**

```ts
embed.setFooter({
  text: 'DooM & Dastardlies — Roll behind the screen',
});
```

**After:**

```ts
embed.addFields({
  name: 'Legal',
  value:
    'By using this bot you agree to our [Terms of Service](https://github.com/ningod/DooMandDastardlies/blob/main/TERMS.md).',
});

embed.setFooter({
  text: 'DooM & Dastardlies — Roll behind the screen',
});
```

This adds a dedicated **Legal** field at the bottom of the help embed with a clickable link.
Discord renders Markdown links inside embed field values, so `[text](url)` will appear as a
hyperlink in the client.

> **Note:** This change has already been applied to `src/commands/help.ts` as part of the legal
> integration. The section above is preserved here as a reference for future maintainers.

---

## 4. GitHub Repository — Canonical Location

The canonical, versioned URL for the Terms is:

```
https://github.com/ningod/DooMandDastardlies/blob/main/TERMS.md
```

Use this URL wherever you need to reference the Terms externally (portal, invite page, support
messages, etc.). The file is tracked in version control, so GitHub preserves the full change
history. If you need to point users to a specific past version, use the commit-specific URL:

```
https://github.com/ningod/DooMandDastardlies/blob/<commit-sha>/TERMS.md
```

---

## 5. Checklist

- [ ] Terms of Service URL set in Discord Developer Portal → General Information
- [ ] Privacy Policy URL set (can reuse TERMS.md URL initially)
- [ ] `/help` command shows a Legal field with a link to TERMS.md
- [ ] `TERMS.md` is committed and pushed to the `main` branch
- [ ] `README.md` Legal section links to `TERMS.md`
- [ ] Invite link tested — Terms URL visible on the authorisation screen
