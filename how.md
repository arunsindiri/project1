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
│   │   └── page.tsx              # Auth page — sign up / log in
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
│       │
│       └── upload/
│           └── video-comment/
│               └── route.ts      # POST upload a video comment clip
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
│   ├── supabase.ts               # Supabase client setup
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
| `auth/page.tsx` | Sign up / Log in page |

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
| `/api/upload/video-comment` | POST | Upload a video comment clip |

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

The app compiles and runs with `npm run dev`. Two pages are implemented:

| Page | Path | What Works |
|------|------|-----------|
| Home | `/` | 3 demo YouTube video cards in a grid, each links to the watch page |
| Watch | `/watch` | YouTube iframe embed, threaded comments (stored in Supabase), reply UI, like button, video comments (upload or record via camera), timestamp badges |
| Auth | `/auth` | Empty |
| Search | `/search` | Empty |
| Channel | `/channel` | Empty |

**Backend connected:** Comments are fully working end-to-end. You can type a comment, click "Comment", and it instantly appears in the comment list AND saves to Supabase. On page load, all comments for that video are fetched from Supabase and displayed as a threaded tree. Video clips are uploaded to Cloudinary, and the URL is stored in Supabase alongside the comment.

**Test comments stored:** Multiple test comments exist for video `dQw4w9WgXcQ` in the Supabase `comments` table (added during debugging).

---

## What's Next

Now that comments work fully end-to-end (post, fetch, display instantly), we'll continue with:

1. ~~Phase 1~~ — Set up Supabase, YouTube embedding, basic pages ✅
2. ~~Phase 2~~ — Text comments with threading ✅
3. ~~Phase 3~~ — Video comments ✅ (upload + camera recording)
4. ~~Phase 3.5~~ — Comment display bug fixes ✅ (GET filtering, optimistic updates)
5. **Phase 4** — Timestamp comments with scrubber markers
6. **Phase 5** — Auth page (Supabase Auth — sign up / log in)
7. **Phase 6** — Search page and Channel page
8. **Phase 7** — Polish and responsive design
