# How We Built This Project — Step by Step

## What This Project Is

This is a **YouTube-style web app** where users can watch real YouTube videos and leave comments. The special part is the comment system:

- You can leave **text comments** or **video comments** (short clips you record/upload)
- You can **anchor a comment to a timestamp** — like saying "look at 1:23" and it shows up on the video's timeline
- Comments are **threaded** — you can reply to any comment, forming a conversation tree

We don't host any videos ourselves. YouTube handles all the video playback. We just embed them using YouTube's player.

---

## What We Did So Far

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
├── styles/
│   └── globals.css               # Global CSS + Tailwind imports
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
| `CommentComposer.tsx` | Input form to write a comment (text or video) |
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

---

## What's Next

Now that the file structure is in place, we'll start implementing:

1. **Phase 1** — Set up Supabase, YouTube embedding, basic pages
2. **Phase 2** — Text comments with threading
3. **Phase 3** — Video comments
4. **Phase 4** — Timestamp comments with scrubber markers
5. **Phase 5** — Polish and responsive design
