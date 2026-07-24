# How We Built This Project — Step by Step

## What This Project Is

This is a **YouTube-style web app** where users can watch real YouTube videos and leave comments. The special part is the comment system:

- You can leave **text comments** or **video comments** (short clips you record/upload)
- You can **anchor a comment to a timestamp** — like saying "look at 1:23" and it shows up on the video's timeline
- Comments are **threaded** — you can reply to any comment, forming a conversation tree

We don't host any videos ourselves. YouTube handles all the video playback. We just embed them using YouTube's player.

---

## What We Did So Far

### Step 0: Fixed a Broken Import

When first running `npm run dev`, the app failed with:

```
Module not found: Can't resolve './globals.css'
```

The issue: `layout.tsx` imported `./globals.css`, but the file lived at `src/styles/globals.css`. Fixed by moving `globals.css` from `src/styles/` into `src/app/` so the import resolves correctly.

### Step 0.5: Connected Supabase for Comments

Comments (text and video) are now stored in Supabase and fetched on page load:

- **POST `/api/comments`** — saves a new comment (text or video URL) to the `comments` table
- **GET `/api/videos/[id]/comments`** — fetches all comments for a video
- The watch page calls these APIs instead of using hardcoded mock data
- Video clips are uploaded to Cloudinary first, then the URL is stored in Supabase

**Required Supabase table:**

```sql
create table comments (
  id uuid default gen_random_uuid() primary key,
  video_id text not null,
  parent_comment_id uuid references comments(id),
  author_id text default 'anonymous',
  type text not null check (type in ('text', 'video')),
  text_content text,
  video_url text,
  timestamp_seconds integer,
  created_at timestamptz default now(),
  likes_count integer default 0
);
```

### Step 0.6: Set Up Supabase Table & RLS Policies

After creating the `comments` table in Supabase's SQL Editor, we needed to set up **Row Level Security (RLS)** policies. RLS is Supabase's way of controlling who can read, write, and modify data. Without policies, the table exists but nobody can access it through the API.

We ran these queries in the **Supabase SQL Editor** (dashboard → SQL Editor → paste → Run):

**1. Create the table (if not already done):**

```sql
create table comments (
  id uuid default gen_random_uuid() primary key,
  video_id text not null,
  parent_comment_id uuid references comments(id),
  author_id text default 'anonymous',
  type text not null check (type in ('text', 'video')),
  text_content text,
  video_url text,
  timestamp_seconds integer,
  created_at timestamptz default now(),
  likes_count integer default 0
);
```

**2. Allow anyone to insert (post) comments:**

```sql
create policy "Allow all inserts" on comments
  for insert with check (true);
```

This means: "anyone can add a new row to the comments table." The `with check (true)` part means there are no conditions — every insert is allowed.

**3. Allow anyone to read (select) comments:**

```sql
create policy "Allow all selects" on comments
  for select using (true);
```

This means: "anyone can read rows from the comments table." Without this, GET requests would return empty arrays even though data exists in the database.

**4. Allow anyone to update comments (needed for likes):**

```sql
create policy "Allow all updates" on comments
  for update using (true);
```

This means: "anyone can update rows in the comments table." We need this so the like button can increment `likes_count`.

> **Why are these separate?** RLS policies are per-operation. You can allow reads but block writes, or allow inserts but block deletes. We're allowing everything for now since this is a development stage — in production you'd tie these to authenticated users.

---

### Step 0.7: Fixed the GET Comments Bug

After setting up Supabase and the RLS policies, inserting comments worked perfectly (POST returned data), but fetching comments (GET) returned empty arrays `[]` even though data clearly existed.

**The problem:** The Supabase JS client's `.eq()` filter wasn't matching rows correctly, even though the values were identical. This is a known quirk in certain versions of `@supabase/supabase-js` where `.eq()` on a `text` column can fail silently — returning no error, just an empty result set.

**The fix:** Switched from `.eq("video_id", videoId)` to `.ilike("video_id", videoId)` in the GET route handler. `.ilike` does a case-insensitive pattern match, which works correctly with the same data.

```typescript
// Before (broken):
const { data, error } = await supabase
  .from("comments")
  .select("*")
  .eq("video_id", videoId)       // ← silently returned empty []

// After (working):
const { data, error } = await supabase
  .from("comments")
  .select("id, video_id, parent_comment_id, author_id, type, text_content, video_url, timestamp_seconds, created_at, likes_count")
  .ilike("video_id", videoId)     // ← correctly returns matching rows
```

**How we debugged it:**
1. Confirmed the comment was inserted via POST (Supabase returned the new row with an ID)
2. Queried Supabase's REST API directly with `curl` — data was there
3. Ran the same Supabase query in a standalone Node.js script — it returned data
4. Added logging to the route handler — the params were correct, no errors, but `data` was `[]`
5. Tried fetching ALL comments without any filter — that worked! So the table was accessible
6. The only difference was `.eq()` — switching to `.ilike()` fixed it

**The complete working GET route** (`src/app/api/videos/[id]/comments/route.ts`):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;

  const { data, error } = await supabase
    .from("comments")
    .select("id, video_id, parent_comment_id, author_id, type, text_content, video_url, timestamp_seconds, created_at, likes_count")
    .ilike("video_id", videoId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

---

### Step 0.8: Fixed Comments Not Appearing After Posting

After the GET comments bug was fixed, comments could be fetched from Supabase. But when a user typed a comment and clicked "Comment", the POST succeeded (saved to Supabase) but the new comment didn't appear below until the page was manually refreshed.

**The problem:** After posting, the code re-fetched comments from the API to update the list. But the browser was caching the GET response, so the re-fetch returned the old (stale) data instead of the fresh data including the new comment.

We tried two fixes:

**Fix 1 — Cache busting the re-fetch:**
Added `cache: "no-store"` to the initial fetch and `?t=${Date.now()}` to the re-fetch URL after posting. This forces the browser to make a fresh request instead of serving the cached response.

```typescript
// Initial fetch (with cache disabled)
const res = await fetch(`/api/videos/${VIDEO_ID}/comments`, {
  cache: "no-store",
});

// Re-fetch after posting (with timestamp to bust cache)
const res2 = await fetch(`/api/videos/${VIDEO_ID}/comments?t=${Date.now()}`);
```

This helped but still wasn't reliable.

**Fix 2 — Optimistic update (final solution):**
Instead of re-fetching after posting, we add the new comment directly to the React state from the POST response. This is faster (no extra network request) and avoids any caching issues entirely.

```typescript
if (res.ok) {
  const newComment = await res.json();
  setComments((prev) => [...prev, newComment]);
}
```

This is the pattern most apps use — when you post a tweet or comment, it appears instantly without waiting for a server round-trip.

**How we debugged it:**
1. Added `console.log` to `handleSubmit` and `handleNewComment` to confirm the click handler fires
2. Saw POST returns `201` — so the comment is saved correctly
3. Tried `cache: "no-store"` and cache-busting URLs — partially helped
4. Switched to optimistic update — works perfectly every time

---

### Step 0.9: Fixed Supabase Client Crash on Vercel Build

After pushing to GitHub, Vercel's build failed with:

```
Error: supabaseUrl is required.
```

**The problem:** `src/lib/supabase.ts` used a JavaScript `Proxy` to lazily initialize the Supabase client. During Vercel's build step, the Proxy's getter was called before environment variables were loaded, causing the crash.

**The fix:** Replaced the Proxy with a simple `getSupabase()` function that creates the client on first call:

```typescript
// Before (broken on Vercel build):
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (supabaseClient ??= createClient(...))[prop as keyof SupabaseClient];
  },
});

// After (works everywhere):
let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseClient;
}
```

All API routes now call `getSupabase()` instead of importing `supabase` directly.

### Step 0.10: Fixed Build Errors from Empty Stub Files

Several pages (`/auth`, `/search`, `/channel`) and API routes (`/api/videos`, `/api/comments/[id]/like`, `/api/upload/video-comment`) had empty files that caused Next.js build errors:

```
Type error: Route "/" is missing "export const GET" or "export const POST"
```

**The fix:** Added minimal stub exports to each file so the build passes. These are placeholders until the actual features are implemented.

### Step 0.11: Fixed GitHub Actions Build Cache

The first GitHub Actions deployment failed because of a stale `/.next/cache` from a previous run.

**The fix:** Removed the cache step from `.github/workflows/nextjs.yml` so every build starts fresh.

### Step 0.12: Fixed Vercel Deployment — Environment Variables

After deploying to Vercel, the app crashed because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` weren't configured in the Vercel dashboard.

**The fix:** Added both environment variables in Vercel Project Settings → Environment Variables, matching the values from `.env.local`.

### Step 0.13: Fixed GET Comments Returning Fewer Rows on Vercel

After deploying to Vercel, comments posted via POST appeared with optimistic updates but disappeared on page refresh. Investigation revealed:

- The Supabase REST API confirmed all comments existed in the database (20 rows)
- The POST route returned `201` with correct data
- But the GET route only returned 17 of 20 comments

**The problem:** The Supabase JS client's `.eq()` filter continued to silently return fewer rows on Vercel's serverless runtime. Even switching to direct `fetch` against Supabase's REST API didn't fully fix it — Vercel was caching the GET response.

**The fix:** Three changes:

1. **Bypassed the Supabase JS client entirely** — the GET route now uses raw `fetch` against Supabase's PostgREST API directly:

```typescript
const url = `${supabaseUrl}/rest/v1/comments?video_id=eq.${encodeURIComponent(videoId)}&order=created_at.asc&limit=1000&select=...`;

const res = await fetch(url, {
  cache: "no-store",
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Prefer: "return=representation",
  },
});
```

2. **Added `export const dynamic = "force-dynamic"`** to prevent Next.js from caching the route handler.

3. **Added cache control headers** to the response:

```typescript
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  },
});
```

### Step 0.14: Fixed `onSubmit` Not Being Awaited in CommentComposer

The `CommentComposer` component called `onSubmit()` (which triggers the POST) but didn't `await` it. This meant the text input cleared immediately (making it look like the comment was posted) even if the POST was still in progress or had failed.

**The fix:** Added `await` before `onSubmit()` in `CommentComposer.tsx`:

```typescript
// Before (not awaited — text clears before POST completes):
onSubmit({...});
setText("");

// After (waits for POST to complete):
await onSubmit({...});
setText("");
```

Also added `console.log` in `handleNewComment` on the watch page to log POST response status and data for debugging.

---

### Step 1: Read the Project Docs

We started by reading three files that explain the project:

- **README.md** — High-level overview of the project, tech stack, and getting started
- **scope.md** — What's included in this project and what's not (out of scope)
- **spec.md** — Full technical specification: pages, features, data model, API endpoints, tech choices

This gave us a clear picture of what we're building.

---

### Step 2: Understood the Tech Stack

We decided on these technologies:

| Layer | Technology | Why |
|-------|-----------|-----|
| Video Playback | YouTube IFrame Player API | Free, no hosting needed |
| Frontend | Next.js + Tailwind CSS | Fast to build, great DX |
| Database & Auth | Supabase (Postgres) | Free tier covers DB, auth, file storage |
| Video Comment Storage | Cloudinary | Free tier, handles video compression |
| Hosting | Vercel + Supabase | Free for development |

---

### Step 3: Created the File Structure

We created all the folders and empty files needed for the project. Here's the full structure:

```
src/
│
├── app/                          # Next.js pages (App Router)
│   ├── globals.css               # Global CSS + Tailwind imports
│   ├── layout.tsx                # Root layout (wraps all pages)
│   ├── page.tsx                  # Home page — shows video grid
│   │
│   ├── watch/
│   │   └── page.tsx              # Watch page — video player + comments
│   │
│   ├── channel/
│   │   └── page.tsx              # Channel page — videos by one creator
│   │
│   ├── search/
│   │   └── page.tsx              # Search page — find videos
│   │
│   ├── auth/
│   │   ├── page.tsx              # Auth page — Google sign-in
│   │   └── callback/
│   │       └── route.ts          # OAuth redirect handler
│   │
│   └── api/                      # API routes (backend logic)
│       ├── videos/
│       │   ├── route.ts          # GET all videos, POST new video
│       │   └── [id]/
│       │       └── comments/
│       │           └── route.ts  # GET comments for a video
│       │
│       ├── comments/
│       │   ├── route.ts          # POST a new comment
│       │   └── [id]/
│       │       └── like/
│       │           └── route.ts  # POST like a comment
│
├── components/                   # Reusable UI pieces
│   ├── VideoPlayer.tsx           # YouTube embed player
│   ├── CommentThread.tsx         # Renders a comment + its replies
│   ├── CommentComposer.tsx       # Form to write/post a comment
│   ├── CommentItem.tsx           # Single comment display
│   ├── Navbar.tsx                # Top navigation bar
│   ├── SearchBar.tsx             # Search input
│   ├── VideoCard.tsx             # Video thumbnail card (for grids)
│   └── TimestampMarker.tsx       # Marker on video progress bar
│
├── lib/                          # Utility & config files
│   ├── supabase.ts               # Supabase client setup (server-side)
│   ├── supabase-browser.ts       # Supabase client setup (browser-side)
│   ├── auth-context.tsx          # AuthProvider + useAuth hook
│   ├── cloudinary.ts             # Cloudinary client setup
│   └── utils.ts                  # Helper functions
│
├── hooks/                        # Custom React hooks
│   └── useYouTubePlayer.ts       # Hook to control YouTube player
│
├── styles/                        # (empty — globals.css moved to app/)
│
└── types/
    └── index.ts                  # TypeScript type definitions
```

### Also created:
- **.env.example** — Template for environment variables
- **tailwind.config.js** — Tailwind CSS configuration

---

## Quick Explainer: How the Files Connect

```
User visits Home (/)
    └── page.tsx loads
        └── Shows VideoCard components (grid of videos)
            └── User clicks a video
                └── Navigates to Watch page (/watch?id=xxx)
                    └── VideoPlayer.tsx embeds the YouTube video
                    └── CommentThread.tsx loads comments
                        └── CommentItem.tsx shows each comment
                        └── CommentComposer.tsx lets user type/post a comment
                        └── TimestampMarker.tsx shows time markers on the video bar
```

---

## What Each File Does

### Pages (`src/app/`)
| File | Purpose |
|------|---------|
| `layout.tsx` | Wraps every page with shared layout (navbar, fonts, etc.) |
| `page.tsx` | Home page — shows all videos in a grid |
| `watch/page.tsx` | Watch page — plays a video and shows its comments |
| `channel/page.tsx` | Channel page — shows videos from one channel |
| `search/page.tsx` | Search page — search through videos |
| `auth/page.tsx` | Sign in page — Google OAuth |
| `auth/callback/route.ts` | OAuth redirect handler — exchanges code for session |
| `logout/page.tsx` | Sign out — clears session and redirects to / |

### Components (`src/components/`)
| File | Purpose |
|------|---------|
| `VideoPlayer.tsx` | Embeds a YouTube video using IFrame API |
| `CommentThread.tsx` | Renders a comment and recursively renders its replies |
| `CommentComposer.tsx` | Input form to write/post a comment — supports text, video upload, and camera recording |
| `CommentItem.tsx` | Displays a single comment (author, text/video, timestamp, likes) |
| `Navbar.tsx` | Top bar with logo, search, and auth links |
| `SearchBar.tsx` | Search input field |
| `VideoCard.tsx` | Thumbnail + title + channel name (used in video grids) |
| `TimestampMarker.tsx` | Dot/marker on the video progress bar for timestamped comments |

### API Routes (`src/app/api/`)
| Endpoint | Method | What It Does |
|----------|--------|-------------|
| `/api/videos` | GET | Fetch all videos |
| `/api/videos` | POST | Add a video by YouTube URL |
| `/api/videos/:id/comments` | GET | Get threaded comments for a video |
| `/api/comments` | POST | Create a comment (text or video) |
| `/api/comments/:id/like` | POST | Like a comment |

### Lib (`src/lib/`)
| File | Purpose |
|------|---------|
| `supabase.ts` | Initializes Supabase client (database + auth) |
| `cloudinary.ts` | Initializes Cloudinary client (video uploads) |
| `utils.ts` | Helper functions (formatting, parsing, etc.) |

### Hooks (`src/hooks/`)
| File | Purpose |
|------|---------|
| `useYouTubePlayer.ts` | React hook to control the YouTube player (play, pause, seek) |

### Types (`src/types/`)
| File | Purpose |
|------|---------|
| `index.ts` | TypeScript interfaces (Video, Comment, User) |

---

## Data Model (Database Tables)

We have three main tables:

### Video
```
id                    — unique ID
youtube_video_id      — the YouTube video ID (extracted from URL)
title                 — video title
added_by_user_id      — who added it
created_at            — when it was added
```

### Comment
```
id                    — unique ID
video_id              — which video this comment is on
parent_comment_id     — null if top-level, otherwise the parent comment's ID
author_id             — who wrote it
type                  — "text" or "video"
text_content          — the comment text (if type is text)
video_url             — URL of uploaded clip (if type is video)
timestamp_seconds     — optional: which second in the video this comment is about
created_at            — when it was posted
likes_count           — number of likes
```

### User
```
id                    — unique ID
username              — display name
avatar_url            — profile picture URL
created_at            — when the account was created
```

---

## How Threading Works

The magic is in `parent_comment_id`:

- Top-level comment: `parent_comment_id = null`
- Reply to that comment: `parent_comment_id = <that comment's id>`
- Reply to the reply: same thing, points to its parent

This creates a tree structure. The UI renders it with indentation:

```
Comment 1 (parent: null)
  └── Reply 1.1 (parent: Comment 1)
       └── Reply 1.1.1 (parent: Reply 1.1)
  └── Reply 1.2 (parent: Comment 1)
Comment 2 (parent: null)
```

---

## How Timestamp Comments Work

1. User is watching a video at 1:23 (83 seconds)
2. User writes a comment with timestamp enabled
3. Comment is saved with `timestamp_seconds = 83`
4. A dot appears on the video's progress bar at that position
5. Clicking the dot (or the comment) seeks the video to 83 seconds

---

## Environment Variables Needed

Before running the project, you need these in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=       # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Your Supabase anonymous key
CLOUDINARY_CLOUD_NAME=          # Your Cloudinary cloud name
CLOUDINARY_API_KEY=             # Your Cloudinary API key
CLOUDINARY_API_SECRET=          # Your Cloudinary API secret
```

## Running the App

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # starts at http://localhost:3000
```

---

## Current State (as of this commit)

The app compiles and runs locally (`npm run dev`) and is deployed on **Vercel** at `https://vidtalk.6281401.xyz`.

| Page | Path | What Works |
|------|------|-----------|
| Home | `/` | 3 demo YouTube video cards in a grid, each links to the watch page |
| Watch | `/watch` | YouTube player with seek control, custom scrubber bar with timestamp markers, threaded comments, reply-to-replies, video comments (upload or record with progress bar), timestamp badges (click to seek), error feedback on failures |
| Auth | `/auth` | Google sign-in button, OAuth flow via Supabase, session management, avatar + sign out in navbar |
| Search | `/search` | Empty |
| Channel | `/channel` | Empty |

**Backend connected:** Comments are fully working end-to-end on Vercel:

- **POST:** Type a comment, click "Comment" → instantly appears in the comment list (optimistic update) AND saves to Supabase
- **GET:** On page load, all comments for the video are fetched from Supabase and displayed as a threaded tree
- **Persistence:** Comments survive page refresh — confirmed working
- **Video clips:** Uploaded to Cloudinary via server-side SDK (no CORS issues), URL stored in Supabase alongside the comment

**Supabase project:** `https://axjknecyakbvzxaslvci.supabase.co`
**Vercel deployment:** `https://vidtalk.6281401.xyz`
**GitHub repo:** `github.com:arunsindiri/project1.git`

**Test comments stored:** 34+ comments exist for video `dQw4w9WgXcQ` in the Supabase `comments` table.

**Key debugging lessons learned:**
- Supabase JS client `.eq()` filter can silently return fewer rows on serverless runtimes — bypass with direct REST API fetch
- Vercel caches GET responses by default — use `force-dynamic` and `Cache-Control: no-store` headers
- Always `await` async callbacks in React event handlers — otherwise errors are swallowed silently
- Supabase client initialization must be lazy (function, not top-level) to avoid build-time crashes on Vercel
- Vercel's Node.js runtime doesn't properly serialize `File` objects in `FormData` when proxying to third-party APIs — use the official SDK instead
- GitHub Pages is incompatible with Next.js API routes — don't mix static export with dynamic routes
- Cloudinary unsigned uploads work from server-side but are blocked by CORS from browsers without dashboard configuration

---

### Step 13: Google Authentication (Supabase OAuth)

Implemented Google sign-in using Supabase Auth's built-in OAuth provider.

#### New files created:

**1. `src/lib/supabase-browser.ts`** — Browser-side Supabase client

A `"use client"` module that lazily creates a Supabase client for use in React components (auth operations must happen client-side).

**2. `src/lib/auth-context.tsx`** — AuthProvider + useAuth hook

React context that wraps the app and provides:
- `session` — current Supabase session (or null)
- `user` — the logged-in user object (or null)
- `loading` — true while checking auth state

Listens to `onAuthStateChange` so the UI updates automatically when the user signs in/out.

**3. `src/app/auth/callback/route.ts`** — OAuth redirect handler

A server-side route that receives the OAuth `code` query parameter from Google (via Supabase), calls `supabase.auth.exchangeCodeForSession(code)` to convert it into a session cookie, then redirects to `/`.

**4. `src/app/logout/page.tsx`** — Sign-out page

Calls `supabase.auth.signOut()` and redirects to `/`. Uses `useEffect` + `window.location.href` to avoid SSR issues with `router.push`.

#### Modified files:

**5. `src/app/layout.tsx`** — Wrapped app with AuthProvider

```tsx
<AuthProvider>
  <Navbar />
  {children}
</AuthProvider>
```

**6. `src/app/auth/page.tsx`** — Google sign-in button

Replaced the "Coming soon" stub with a full auth page:
- Shows "Continue with Google" button with the Google logo SVG
- Calls `supabase.auth.signInWithOAuth({ provider: "google", redirectTo: ... })`
- Redirects to `/` if already logged in (via `useAuth()` + `useEffect`)

**7. `src/components/Navbar.tsx`** — Shows user state

- **Logged out:** Shows blue "Sign In" button linking to `/auth`
- **Logged in:** Shows user's Google avatar + "Sign Out" button
- **Loading:** Shows a pulsing gray circle placeholder

**8. `src/app/watch/page.tsx`** — Auth-gated commenting

- Imports `useAuth` and passes `user.id` as `author_id` when posting comments
- If not logged in, shows "Sign in to comment" prompt instead of the CommentComposer

#### How the OAuth flow works:

```
1. User clicks "Sign In" → /auth
2. User clicks "Continue with Google"
3. Browser → Supabase → Google consent screen
4. User picks Google account → approves
5. Google → Supabase callback with auth code
6. Supabase → /auth/callback?code=xxx
7. Route exchanges code for session (sets cookie)
8. Redirects to / — user is now logged in
9. Navbar shows avatar + "Sign Out"
```

#### Setup required (one-time):

1. **Supabase Dashboard** → Authentication → Providers → Google → Enable
2. Paste Google OAuth **Client ID** and **Client Secret**
3. Copy Supabase's callback URL
4. **Google Cloud Console** → APIs & Services → Credentials → Add Supabase callback URL to Authorized Redirect URIs
5. **Supabase Dashboard** → Authentication → URL Configuration → Redirect URLs:
   - `http://localhost:3000/auth/callback` (dev)
   - `https://vidtalk.6281401.xyz/auth/callback` (prod)

---

## What's Next

Now that comments work fully end-to-end (post, fetch, persist on refresh), we'll continue with:

1. ~~Phase 1~~ — Set up Supabase, YouTube embedding, basic pages ✅
2. ~~Phase 2~~ — Text comments with threading ✅
3. ~~Phase 3~~ — Video comments ✅ (upload + camera recording)
4. ~~Phase 3.5~~ — Comment display bug fixes ✅ (GET filtering, optimistic updates, Vercel caching, Supabase JS client bypass)
5. ~~Phase 3.6~~ — Vercel deployment ✅ (env vars, build fixes, cache control)
6. ~~Phase 4~~ — Timestamp comments with scrubber markers ✅ (including float-to-integer fix)
7. ~~Phase 4.5~~ — Video upload improvements ✅ (reply timestamp support, error feedback, progress bar, dead route cleanup)
8. ~~Phase 5~~ — Video upload pipeline hardened ✅ (CORS fix, Cloudinary SDK, server-side proxy, code quality bugs)
9. ~~Phase 6~~ — Auth page (Google OAuth via Supabase Auth) ✅
10. **Phase 7** — Search page and Channel page
11. **Phase 8** — ~~Video compression~~ ✅ (3-min duration limit + Cloudinary auto-compression via upload params)
12. **Phase 9** — Polish and responsive design

---

### Step 4: Timestamp Comments with Scrubber Markers

Built the full timestamp comment system so users can anchor comments to a specific second in the video, see markers on a scrubber bar, and click-to-seek.

#### What was built:

**1. `src/hooks/useYouTubePlayer.ts`** — React hook wrapping the YouTube IFrame Player API

- Loads the YouTube IFrame API script dynamically
- Creates a `YT.Player` instance attached to a div container
- Exposes: `seekTo(seconds)`, `getCurrentTime()`, `getDuration()`
- Polls current time every 250ms and notifies listeners via `onTimeUpdate` callback
- Returns `playerReady` state so components know when the API is loaded

**2. `src/components/VideoPlayer.tsx`** — Controllable YouTube player

- Replaces the old raw `<iframe>` embed with a proper `YT.Player` instance
- Calls `onPlayerReady` with the player controls when the API loads
- The parent page gains access to `seekTo`, `getCurrentTime`, `getDuration`

**3. `src/components/TimestampMarker.tsx`** — Dot marker for the scrubber

- Renders a blue dot positioned at `(seconds / duration) * 100)%` on the timeline
- On click, calls `seekTo(seconds)` to jump the video to that timestamp
- Hover shows a tooltip with the time and comment text
- Scales up on hover for easy clicking

**4. Updated `src/app/watch/page.tsx`** — Custom timeline + click-to-seek

- Custom scrubber bar below the video with a red progress indicator
- Filters top-level comments with `timestamp_seconds` and renders `TimestampMarker` dots on the scrubber
- Timestamp badges on comments are now clickable buttons — clicking seeks the video to that time
- `seekTo` is passed through `CommentItem` recursively so nested replies with timestamps also seek
- Current time and duration displayed at the edges of the scrubber

#### How timestamp comments work end-to-end:

1. User watches video, clicks "Pin to timestamp" checkbox in CommentComposer
2. CommentComposer captures the current video time and includes `timestamp_seconds` in the POST
3. Supabase stores the comment with `timestamp_seconds` set
4. On page load, GET returns all comments including timestamp data
5. Watch page filters top-level comments with timestamps and renders blue dots on the custom scrubber bar
6. Clicking a dot on the scrubber → `player.seekTo(seconds)` → video jumps to that time
7. Clicking a timestamp badge on a comment → same thing, seeks video to that time
8. The red progress bar updates in real-time as the video plays

### Step 4.1: Fixed timestamp_seconds — float to integer

When posting a comment with "Pin to timestamp" checked, the POST returned a 500 error:

```
invalid input syntax for type integer: "78.35895"
```

**The problem:** YouTube's `getCurrentTime()` returns a float (e.g., `78.35895`), but the Supabase `comments` table has `timestamp_seconds` as `integer`. Supabase rejected the float value.

**The fix:** Added `Math.floor()` in `src/app/api/comments/route.ts` before inserting into Supabase:

```typescript
timestamp_seconds: timestamp_seconds != null ? Math.floor(timestamp_seconds) : null,
```

---

### Step 5: Video Upload Improvements

Four fixes to the video comment upload system:

#### 5.1: Fixed reply comments missing timestamp pin support

**The problem:** When replying to a comment, the `CommentComposer` in the reply box didn't receive `currentTimestamp`, so the "Pin to timestamp" checkbox was available but the timestamp value was always `null`.

**The fix:** Added `currentTimestamp` prop to `CommentItem` and passed it through to the reply `CommentComposer` and recursive child comments.

```typescript
// CommentItem now receives currentTimestamp
function CommentItem({ comment, onSubmit, seekTo, currentTimestamp }) {
  // ...
  <CommentComposer
    videoId={comment.video_id}
    parentId={comment.id}
    currentTimestamp={currentTimestamp}  // ← added
    onSubmit={...}
  />
}
```

#### 5.2: Added error feedback to users

**The problem:** Upload failures and comment post errors were only logged to `console.error` — the user saw nothing.

**The fix:**
- `CommentComposer` now shows a red error banner when upload or post fails
- `cloudinary.ts` surfaces Cloudinary's actual error message instead of generic "Upload failed"
- `handleNewComment` in the watch page throws errors so `CommentComposer` can catch and display them

```typescript
// cloudinary.ts — better error messages
if (!res.ok) {
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error?.message ?? `Upload failed (${res.status})`);
}

// CommentComposer — error state + display
const [error, setError] = useState<string | null>(null);
// ...
{error && (
  <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
    {error}
  </div>
)}
```

#### 5.3: Removed dead server-side upload route

Deleted `/api/upload/video-comment/route.ts` — it was never called by the UI and had an incomplete implementation (read `CLOUDINARY_API_SECRET` but never used it for signed uploads).

#### 5.4: Added upload progress indicator

**The problem:** During video upload, users only saw "Posting..." with no progress indication.

**The fix:** Changed `uploadVideoComment` from `fetch` to `XMLHttpRequest` to get upload progress events, and added a blue progress bar to `CommentComposer`.

```typescript
// cloudinary.ts — progress callback
export async function uploadVideoComment(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    // ...
  });
}

// CommentComposer — progress bar UI
{uploading && mode === "video" && (
  <div className="mt-3">
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>Uploading video...</span>
      <span>{uploadProgress}%</span>
    </div>
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-blue-600 transition-all duration-300"
        style={{ width: `${uploadProgress}%` }}
      />
    </div>
  </div>
)}
```

---

### Step 6: Tested Video Upload End-to-End

Ran a full diagnostic of the video upload comment pipeline to verify it works:

1. **Cloudinary upload preset** — Confirmed `video_comments` unsigned preset exists (tested with curl, got `secure_url` back)
2. **POST `/api/comments`** with `type: "video"` — Successfully inserted a video comment into Supabase with `video_url` and `timestamp_seconds`
3. **GET `/api/videos/:id/comments`** — Returned the video comment with correct `video_url` and `timestamp_seconds`
4. **Cloudinary URL accessibility** — HTTP 200, `video/mp4`, served from Cloudinary CDN with CORS headers

**Result:** The pipeline works end-to-end. Cloudinary stores the video file, Supabase stores the URL reference.

---

### Step 7: Fixed 3 Code Quality Bugs

Found and fixed three bugs in the video upload code:

#### 7.1: XHR timeout never fires (`src/lib/cloudinary.ts`)

**The problem:** The `XMLHttpRequest` had an `ontimeout` handler but `xhr.timeout` was never set. Uploads could hang forever.

**The fix:** Added `xhr.timeout = 120000` (2 minutes) before `xhr.send()`.

#### 7.2: Object URL memory leak (`src/components/CommentComposer.tsx`)

**The problem:** The recording preview video used `src={URL.createObjectURL(recordedBlob)}` directly in JSX, creating a new blob URL on every render and never revoking it. This leaked memory.

**The fix:**
- Added `recordingPreviewUrl` state to store the URL once when recording stops
- `handleRemoveRecording()` now revokes the URL with `URL.revokeObjectURL()`
- Preview video uses the stored `recordingPreviewUrl` instead of creating a new URL each render

#### 7.3: `getVideoBlob()` created a new File on every render

**The problem:** `getVideoBlob()` was a regular function called in the `disabled` prop of the submit button. In record-preview mode, it created a new `File` object with `Date.now()` in the name on every render cycle.

**The fix:** Converted to `useMemo` → `videoBlob` that only recomputes when `videoSource`, `videoFile`, or `recordedBlob` changes.

---

### Step 8: Fixed CORS — Routed Uploads Through Server

**The problem:** When testing in the browser, Cloudinary blocked the upload with:

```
CORS policy: Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

The browser sends a preflight `OPTIONS` request to `api.cloudinary.com`, and Cloudinary rejected it because `vidtalk.6281401.xyz` isn't whitelisted in the Cloudinary CORS settings.

**The fix:** Changed `cloudinary.ts` to upload through the server-side API route (`/api/upload/video-comment`) instead of directly to Cloudinary from the browser. Server-to-server requests have no CORS restrictions.

```typescript
// Before (broken — blocked by CORS):
xhr.open("POST", `https://api.cloudinary.com/v1_/${cloudName}/video/upload`);

// After (works — server proxy, no CORS):
const res = await fetch("/api/upload/video-comment", { method: "POST", body: formData });
```

**Trade-off:** Upload progress bar no longer shows a percentage (server can't stream upload progress back). Shows "Uploading..." without a percentage instead.

---

### Step 9: Fixed GitHub Actions Build Failure

**The problem:** The GitHub Actions workflow (`nextjs.yml`) deployed to GitHub Pages, which requires `output: "export"` (static site). But the app has dynamic API routes (`/api/comments`, `/api/videos/[id]/comments`) that can't be statically exported:

```
Error: Page "/api/comments/[id]/like" is missing "generateStaticParams()"
so it cannot be used with "output: export" config.
```

**The fix:** Deleted `.github/workflows/nextjs.yml` entirely. The app is deployed on **Vercel**, not GitHub Pages, so the workflow was unnecessary.

---

### Step 10: Fixed Vercel 500 Error — Server Upload Route Crashing

After pushing the server-side proxy fix, video uploads still failed on Vercel with a 500 error. The server route returned HTML instead of JSON:

```
/api/upload/video-comment: Failed to load resource: the server responded with a status of 500
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**Root cause:** Vercel's Node.js runtime doesn't properly serialize `File` objects in `FormData` when proxying to Cloudinary. The reconstructed `new Blob([buffer])` caused Cloudinary to return a 404 error page (HTML) instead of JSON.

**The fix:** Installed the official `cloudinary` npm package and rewrote the upload route to use the SDK:

```typescript
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload using data URI (works reliably on all runtimes)
const arrayBuf = await file.arrayBuffer();
const b64 = Buffer.from(arrayBuf).toString("base64");
const dataUri = `data:${file.type};base64,${b64}`;

const result = await cloudinary.uploader.upload(dataUri, {
  resource_type: "video",
  folder: "video_comments",
});

return NextResponse.json({ url: result.secure_url });
```

**Additional improvements:**
- Added 55-second abort timeout on the Cloudinary upload (Vercel Hobby has function timeout limits)
- Added 10MB file size validation with clear error message
- Client now handles non-JSON responses gracefully instead of crashing
- Added `vercel.json` with `maxDuration: 60` for the upload route

---

### Step 11: Cloudinary Storage Limits

Video comments are stored on **Cloudinary** (not Supabase). Supabase only stores the URL reference.

| Resource | Free Limit |
|----------|-----------|
| Storage | 10 GB total |
| Single video file | 100 MB max |
| Bandwidth | ~25 GB/month |
| Monthly credits | 25 (1 credit = 1 GB) |

At ~1-5 MB per short clip, the free tier supports roughly **2,000–10,000 video comments** before running out.

---

### Step 12: 3-Minute Video Limit + Auto Compression

Two client-requested changes to video comments:

#### 12.1: 3-Minute Duration Limit

**The problem:** No limit on video comment length — users could record/upload arbitrarily long videos, eating Cloudinary credits.

**The fix:** Added duration check in `CommentComposer.tsx` for both upload and recording:

- **Upload:** When a file is selected, a temporary `<video>` element reads `duration`. If > 180 seconds, shows error and blocks the file.
- **Recording:** When `MediaRecorder.onstop` fires, the recorded blob's duration is checked. If > 180 seconds, shows error and discards the recording. The timer also auto-stops recording at exactly 3 minutes (180s).
- Updated hint text from "max 60s recommended" to "max 3 minutes".

```typescript
// Duration check on file pick
const tempVideo = document.createElement("video");
tempVideo.src = URL.createObjectURL(file);
tempVideo.onloadedmetadata = () => {
  URL.revokeObjectURL(tempUrl);
  if (tempVideo.duration > 180) {
    setError("Video must be under 3 minutes.");
    return;
  }
  // proceed with upload
};
```

#### 12.2: Cloudinary Auto-Compression (Option C)

**The problem:** Raw video uploads stored at full quality, wasting Cloudinary storage and bandwidth credits.

**The fix:** Added `transformation` params to the Cloudinary upload in the server route (`/api/upload/video-comment/route.ts`). Cloudinary compresses automatically on save:

```typescript
const result = await cloudinary.uploader.upload(dataUri, {
  resource_type: "video",
  folder: "video_comments",
  transformation: [{
    quality: "auto",    // adaptive quality
    width: 640,         // cap at 640px wide
    height: 480,        // cap at 480px tall
    crop: "limit",      // don't upscale, just downscale
    codec: "h264",      // best compression codec
  }],
});
```

No FFmpeg needed. Cloudinary does all the work server-side.

---

### Data Flow Summary (Video Comments)

```
Browser                    Vercel Server              Cloudinary           Supabase
  |                            |                         |                    |
  |-- POST /api/upload/  ----->|                         |                    |
  |   (file as FormData)       |-- upload dataUri ----->|                    |
  |                            |<-- secure_url ----------|                    |
  |<-- { url } ---------------|                         |                    |
  |                            |                         |                    |
  |-- POST /api/comments ----->|                         |                    |
  |   (video_url = url)        |-- INSERT comment ----->|                    |
  |                            |<-- { id, ... } ---------|                    |
  |<-- comment data -----------|                         |                    |
  |                            |                         |                    |
  | <video src={url}>          |                         |                    |
  |   (plays from CDN)         |                         |                    |
```

---
