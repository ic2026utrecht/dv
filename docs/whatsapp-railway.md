# Deploy Evolution API on Railway

Step-by-step for IC2026 control room WhatsApp. Your Nuxt app stays on GitHub Pages;
Evolution runs on Railway and talks to Supabase webhooks.

> **Policy note:** Railway staff have said unofficial WhatsApp Web bots may be restricted;
> official Meta Cloud API is preferred on their platform. Baileys/Evolution for groups can
> still work on Hobby in practice, but if Railway blocks the image, use a small VPS
> (Hetzner/DigitalOcean) instead — same env vars, Docker Compose from
> [whatsapp-setup.md](./whatsapp-setup.md).

## What you will create

1. A Railway project with **Postgres** + **Evolution API**
2. Public HTTPS URL → `EVOLUTION_API_URL`
3. API key you choose → `EVOLUTION_API_KEY`
4. Webhook secret → `EVOLUTION_WEBHOOK_SECRET`
5. Those secrets stored in Supabase Edge Functions

## Step 1 — Railway account

1. Go to [https://railway.app](https://railway.app) and sign up (GitHub login is fine).
2. Start a **Hobby** plan if prompted (needed for always-on + public URL).

## Step 2 — New project + Postgres

1. **New Project** → **Add Database** → **PostgreSQL**.
2. Wait until Postgres is online.
3. Open the Postgres service → **Variables** → copy `DATABASE_URL`
   (Railway usually provides this; Evolution expects a Postgres URI).

## Step 3 — Deploy Evolution (Docker image)

1. In the same project: **New** → **Docker Image**.
2. Image:

   ```text
   evoapicloud/evolution-api:v2.2.3
   ```

   (Do **not** use the old `atendai/evolution-api` image — it moved.)

3. After the service is created, open it → **Settings**:
   - **Generate domain** (Networking / Public Networking) → copy the URL, e.g.  
     `https://evolution-api-production-xxxx.up.railway.app`
   - That URL is your **`EVOLUTION_API_URL`** (no trailing slash).

4. Add a **Volume** (Settings → Volumes) mounted at:

   ```text
   /evolution/instances
   ```

   so WhatsApp sessions survive redeploys.

## Step 4 — Environment variables (Evolution service)

Open the Evolution service → **Variables** → add:

| Variable | Value |
|----------|--------|
| `SERVER_URL` | Your Railway public URL (same as `EVOLUTION_API_URL`) |
| `AUTHENTICATION_API_KEY` | Long random secret (see below) |
| `DATABASE_ENABLED` | `true` |
| `DATABASE_PROVIDER` | `postgresql` |
| `DATABASE_CONNECTION_URI` | `${{Postgres.DATABASE_URL}}` (Railway reference) **or** paste the Postgres URL |
| `WEBHOOK_GLOBAL_ENABLED` | `true` |
| `WEBHOOK_GLOBAL_URL` | `https://msvyekticsjjqdaadult.supabase.co/functions/v1/whatsapp-webhook` |
| `WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS` | `true` |
| `WEBHOOK_EVENTS_MESSAGES_UPSERT` | `true` |
| `WEBHOOK_EVENTS_CONNECTION_UPDATE` | `true` |
| `WEBHOOK_EVENTS_QRCODE_UPDATED` | `true` |

Generate secrets locally:

```bash
# API key (AUTHENTICATION_API_KEY / EVOLUTION_API_KEY)
openssl rand -hex 32

# Webhook secret (EVOLUTION_WEBHOOK_SECRET) — also send as Evolution webhook apikey header if configured
openssl rand -hex 24
```

If Evolution supports custom webhook headers in your version, set header:

```http
apikey: <EVOLUTION_WEBHOOK_SECRET>
```

If your Evolution build does not send custom headers, either leave `EVOLUTION_WEBHOOK_SECRET` empty in Supabase (webhook accepts without secret — less ideal) or configure Evolution’s webhook auth to match what `whatsapp-webhook` expects (`apikey` or `x-webhook-secret`).

Redeploy the Evolution service after saving variables.

## Step 5 — Create the WhatsApp instance

With Evolution online, run (replace URL + key):

```bash
curl -X POST "$EVOLUTION_API_URL/instance/create" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "ic2026-controlroom",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true
  }'
```

You should get JSON back (instance created / QR data). Instance name must match Supabase secret `EVOLUTION_INSTANCE_NAME`.

## Step 6 — Wire Supabase secrets

From the controlroom repo (logged in with Supabase CLI):

```bash
supabase secrets set \
  EVOLUTION_API_URL=https://YOUR-SERVICE.up.railway.app \
  EVOLUTION_API_KEY=YOUR_AUTHENTICATION_API_KEY \
  EVOLUTION_INSTANCE_NAME=ic2026-controlroom \
  EVOLUTION_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET \
  --project-ref msvyekticsjjqdaadult
```

Functions are already deployed (`whatsapp-webhook`, `whatsapp-manage`). Redeploy only if you changed function code:

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref msvyekticsjjqdaadult
supabase functions deploy whatsapp-manage --project-ref msvyekticsjjqdaadult
```

## Step 7 — Connect in the app

1. Open the control room as **admin** → **WhatsApp**.
2. **Instellingen** → scan QR (WhatsApp → Gekoppelde apparaten → Apparaat koppelen).
3. **Groepen syncen** → toggle monitored channels.
4. Feed goes live for all staff.

## Checklist

- [ ] Railway Postgres running
- [ ] Evolution image `evoapicloud/evolution-api:v2.2.3` deployed
- [ ] Public domain generated → `SERVER_URL` / `EVOLUTION_API_URL`
- [ ] Volume on `/evolution/instances`
- [ ] Env vars set (DB + webhook + API key)
- [ ] Instance `ic2026-controlroom` created
- [ ] Supabase secrets set
- [ ] Admin scanned QR in `/whatsapp`

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Container create fails | Use `evoapicloud/evolution-api:v2.2.3`, not `atendai/...`. Cmd/Ctrl+K → **Redeploy source image** |
| 401 from Evolution | Wrong `AUTHENTICATION_API_KEY` / `EVOLUTION_API_KEY` |
| QR never appears | Check Evolution logs; `SERVER_URL` must be the public HTTPS URL |
| Messages not in feed | Webhook URL wrong; group not monitored; check Supabase function logs |
| Session lost after redeploy | Volume missing at `/evolution/instances` |

## Cost (ballpark)

Hobby plan + Postgres + always-on Evolution is typically a few dollars/month. Stop the service when the congress is over to avoid idle cost.
