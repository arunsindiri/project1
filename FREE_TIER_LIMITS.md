# Free Tier Limits — VidTalk Project

All the services VidTalk uses on their free plans. Last verified: July 2026.

---

## Vercel (Hosting & Deployment)

| Resource | Free Limit | Notes |
|----------|-----------|-------|
| **Bandwidth** | 100 GB/month | Includes HTML, CSS, JS, API responses. ~50K–100K pageviews. |
| **Serverless Function Invocations** | 1,000,000/month | Every API call, SSR render, middleware counts. |
| **Active CPU Time** | 4 hours/month | Total compute across all function invocations. |
| **Function Timeout** | 60 seconds | Max duration per single function call. |
| **Build Minutes** | 6,000/month | A typical Next.js build = 1–5 min (~2,000 deploys/month). |
| **Concurrent Builds** | 1 | Builds queue up if you push multiple commits fast. |
| **Deployments per Day** | 100 | |
| **Edge Requests** | 1,000,000/month | |
| **Image Optimizations** | 1,000/month | |
| **Blob Storage** | 1 GB | |
| **Web Analytics** | 50,000 events/month | |
| **Speed Insights** | 10,000 data points/month | |
| **Team Members** | 1 (personal only) | No collaborators. |
| **Custom Domains** | 50 per project | |
| **SSL Certificates** | Auto (Let's Encrypt) | |
| **Commercial Use** | **NOT allowed** | Hobby = personal/learning only. |
| **Support** | Community / forum only | |

### What happens when you exceed Vercel limits?
- Deployments pause. Static content stays live but API routes may fail.
- No overage charges — site goes down, doesn't bill you.
- Limits reset on the 1st of each month.
- Vercel sends warnings at 80% and 100% usage.

---

## Supabase (Database, Auth, Storage)

| Resource | Free Limit | Notes |
|----------|-----------|-------|
| **Database Storage** | 500 MB | Shared CPU, 500 MB RAM. |
| **File Storage** | 1 GB | For Supabase Storage (not used in VidTalk). |
| **Bandwidth (Egress)** | 5 GB/month | 5 GB cached + 5 GB uncached. Includes DB, storage, and functions. |
| **Monthly Active Users (Auth)** | 50,000 MAUs | Only counts users who log in that month. |
| **Edge Function Invocations** | 500,000/month | |
| **Realtime Connections** | 200 concurrent | |
| **Active Projects** | 2 | Can't have more than 2 free projects. |
| **API Requests** | Unlimited | Within bandwidth cap. |
| **Log Retention** | 7 days | |
| **Backups** | None | Manual backup via CLI only. |
| **Commercial Use** | **Allowed** | Unlike Vercel, Supabase permits commercial use on free. |
| **Support** | Community only | |

### Supabase 7-Day Pause Rule
**Projects with no activity for 7 days are automatically paused.** This is the #1 gotcha. Workarounds:
- Set up a cron job / GitHub Action that pings the database daily
- Use Uptime Robot to keep the project alive
- Manually restore from the Supabase dashboard (takes ~60 seconds cold start)

### What happens when you exceed Supabase limits?
- Database rejects writes beyond 500 MB
- Storage uploads stop at 1 GB
- Bandwidth requests return errors after 5 GB
- New signups blocked after 50,000 MAUs
- Data is retained when project pauses — you can restore it

---

## Cloudinary (Video Comment Storage)

| Resource | Free Limit | Notes |
|----------|-----------|-------|
| **Credits** | 25/month | 1 credit = 1 GB storage OR 1 GB bandwidth OR 1,000 transformations. |
| **Managed Storage** | ~10 GB | (from Cloudinary's 2025 announcement; credits-based in practice) |
| **Bandwidth (Delivery)** | ~25 GB/month | (from credits; bandwidth usually runs out first) |
| **Transformations** | 25,000/month | (25 credits × 1,000 each) |
| **Single File Size** | 100 MB max | For video uploads on the free plan. |
| **Team Members** | 3 users | |
| **Upload Presets** | Unlimited | Unsigned and signed presets. |
| **Commercial Use** | **Allowed** | |
| **Support** | Forums, tickets, email | |

### How credits work
Everything shares one pool of 25 credits. Using 1 GB of storage costs 1 credit. Delivering 1 GB of bandwidth costs 1 credit. Doing 1,000 image transformations costs 1 credit. You choose how to spend them.

### What happens when you exceed Cloudinary limits?
- Soft limits — Cloudinary warns you, then may suspend the account.
- No overage billing on Free/Plus/Advanced.
- Delivery bandwidth is almost always what runs out first.

---

## VidTalk Actual Usage (Estimated)

| Service | What We Use | Estimated Usage | Free Limit | Headroom |
|---------|-------------|-----------------|------------|----------|
| **Vercel** | Hosting, API routes | ~5–10 GB bandwidth, ~5K invocations/mo | 100 GB / 1M invocations | Very safe |
| **Supabase** | Comments DB, auth (future) | ~5 MB DB, ~2 GB egress/mo | 500 MB / 5 GB | Safe (watch egress) |
| **Cloudinary** | Video comment clips | ~2–5 GB storage, ~5–10 GB delivery/mo | 25 credits (~10–25 GB) | Tight on bandwidth |

### Biggest risks
1. **Supabase 7-day pause** — set up a keep-alive cron job
2. **Supabase 5 GB bandwidth** — video comments served from Cloudinary, not Supabase, so this stays low
3. **Cloudinary 25 credits** — if video comments get heavy, delivery bandwidth eats credits fast
4. **Vercel non-commercial** — can't monetize on Hobby plan

### Total monthly cost on free tier: **$0**
