# WhatsApp Group Monitor — Setup

Shared control-room inbox: one WhatsApp account connects via QR (Evolution API),
messages from monitored groups land in Supabase, and all staff see the same live feed on `/whatsapp`.

> **Note:** Evolution API uses WhatsApp Web under the hood. That violates Meta’s Terms of Service.
> Use only for internal ops (control room), not as a public product. Sessions can drop; reconnect via QR.

Alleen admins mogen WhatsApp koppelen (QR scannen). Medewerkers zien de gedeelde feed zodra een admin verbonden heeft.

## 1. Deploy Evolution API

Run Evolution API on a **persistent host** (VPS, Railway, Fly.io, etc.). It cannot run on GitHub Pages.

**Prefer Railway?** Follow the dedicated guide: **[whatsapp-railway.md](./whatsapp-railway.md)**.

Example Docker Compose (VPS / local):

```yaml
services:
  evolution-api:
    image: evoapicloud/evolution-api:v2.2.3
    restart: always
    ports:
      - "8080:8080"
    environment:
      SERVER_URL: https://evolution.example.com
      AUTHENTICATION_API_KEY: change-me-to-a-long-secret
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://user:pass@db:5432/evolution
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_GLOBAL_URL: https://msvyekticsjjqdaadult.supabase.co/functions/v1/whatsapp-webhook
      WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS: "true"
      WEBHOOK_EVENTS_MESSAGES_UPSERT: "true"
      WEBHOOK_EVENTS_CONNECTION_UPDATE: "true"
      WEBHOOK_EVENTS_QRCODE_UPDATED: "true"
    volumes:
      - evolution_instances:/evolution/instances

volumes:
  evolution_instances:
```

Create one instance after deploy, e.g. `ic2026-controlroom`:

```bash
curl -X POST "https://evolution.example.com/instance/create" \
  -H "apikey: YOUR_EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "ic2026-controlroom",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true
  }'
```

Optionally set a per-instance webhook pointing at the same Supabase function, with header:

```http
apikey: YOUR_EVOLUTION_WEBHOOK_SECRET
```

## 2. Supabase Edge Function secrets

Set these on the Supabase project (Dashboard → Edge Functions → Secrets, or CLI):

```bash
supabase secrets set \
  EVOLUTION_API_URL=https://evolution.example.com \
  EVOLUTION_API_KEY=YOUR_EVOLUTION_API_KEY \
  EVOLUTION_INSTANCE_NAME=ic2026-controlroom \
  EVOLUTION_WEBHOOK_SECRET=YOUR_EVOLUTION_WEBHOOK_SECRET
```

Also ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are available to functions (usually auto-injected).

Deploy functions:

```bash
supabase functions deploy whatsapp-webhook
supabase functions deploy whatsapp-manage
```

Apply the WhatsApp migration:

```bash
supabase db push
# or: supabase migration up
```

## 3. Connect in the control room

1. Log in as **admin** → open **WhatsApp** in the nav.
2. Open **Instellingen** → scan the QR with the control-room phone
   (WhatsApp → Gekoppelde apparaten → Apparaat koppelen).
3. Click **Groepen syncen**.
4. Toggle **Monitor** on the important groups.
5. The live feed shows inbound messages; all staff see the same inbox.

## 4. Switching phones

1. Admin → Instellingen → **Verbinding verbreken**.
2. Scan QR with the new phone.
3. Re-sync groups and re-check monitored channels.

Historical messages stay in Supabase. New messages only arrive from groups the new phone is in.

## 5. Ops tips

- Prefer a dedicated control-room handset, not a personal number.
- If status shows disconnected, open Instellingen and reconnect.
- Webhook must reach Supabase from the Evolution host (public HTTPS).
- Client `.env` does **not** need Evolution secrets — only Edge Functions do.
