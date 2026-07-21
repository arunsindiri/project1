# Video Platform with Threaded Video Comments

A YouTube-style web interface that embeds real YouTube videos and adds a custom comment layer where viewers can reply with **text or video**, tied to specific **timestamps**, structured as **nested threaded conversations**.

## What This Project Is

- The video content itself is **real YouTube videos**, embedded via the YouTube Player — this project does not host or stream video.
- The custom layer built on top is the **comment system**:
  - Comments can be **text** or a short **video clip**
  - Comments can be pinned to a **specific timestamp** in the video
  - Replies nest under the comment they respond to, forming a **thread/tree** (not a flat list)

See `SPEC.md` for full feature and data details, and `SCOPE.md` for what is / isn't included in this phase of work.

## Tech Stack

| Layer | Choice |
|---|---|
| Video playback | YouTube IFrame Player API |
| Frontend | React / Next.js + Tailwind CSS |
| Backend / DB / Auth | Supabase (Postgres + Auth + Storage) |
| Video comment storage | Cloudinary |
| Hosting | Vercel (frontend) + Supabase (backend) |

All of the above are free at development/demo scale. See `SCOPE.md` for notes on paid upgrades at production scale.

## Getting Started (Development)

```bash
# 1. Clone the repo
git clone <repo-url>
cd <project-folder>

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#          CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

# 4. Run the dev server
npm run dev
```

## Project Structure (suggested)

```
/app or /pages        → Next.js routes (home, watch page, channel, etc.)
/components           → UI components (VideoPlayer, CommentThread, CommentComposer, etc.)
/lib                   → Supabase client, Cloudinary client, helper functions
/styles                → Tailwind config & globals
SPEC.md                → Full feature & data model specification
SCOPE.md               → In-scope / out-of-scope breakdown and open questions
```

## Core Feature at a Glance

A comment is either **text** or **video**, can be anchored to a **video timestamp**, and always knows its **parent comment** (or `null` if top-level) — that one relationship is what powers threading, timestamp-linking, and future features like collapsing long threads.
