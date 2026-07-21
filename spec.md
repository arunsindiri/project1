# Technical Specification

## 1. Overview

This application replicates the core YouTube viewing experience, but embeds **real YouTube videos** rather than hosting original video content. The differentiating work is a custom **comment system** layered on top of each embedded video, supporting:

1. **Video comments** — a comment/reply can itself be a short video, not just text
2. **Timestamp comments** — a comment can be anchored to a specific moment in the video's timeline
3. **Threaded conversations** — comments and replies form a nested tree, not a flat list

## 2. Pages

| Page | Description |
|---|---|
| Home | Grid/list of embedded videos (added by admin or pasted by URL) with title, channel, views |
| Watch Page | Embedded YouTube player + title/description + comment section |
| Channel Page | Simple channel profile grouping a set of videos |
| Search | Search across videos already added to the platform |
| Auth | Sign up / log in (required to comment) |

## 3. Core Feature Detail

### 3.1 Video Embedding
- Videos are added by pasting a YouTube URL (or video ID); the app extracts the ID and renders it via the **YouTube IFrame Player API**.
- The app does **not** upload, store, transcode, or stream the main video file — YouTube handles all of that.
- The IFrame Player API also exposes the current playback time, which is what timestamp comments rely on.

### 3.2 Comment Types
A comment is one of:
- **Text** — a plain text message
- **Video** — a short user-recorded/uploaded video clip (stored by the app itself, since this is user-generated content, not YouTube content)

### 3.3 Timestamp Comments
- When posting a comment, the user can optionally attach the video's **current timestamp** (in seconds) at the moment they wrote it.
- Timestamped comments are shown as markers on the video's progress/scrubber bar.
- Clicking a timestamped comment (or its marker) seeks the embedded player to that second.
- Comments can be sorted by timestamp in addition to by recency/popularity.

### 3.4 Threading
- Every comment stores a reference to its **parent comment** (`null` if it's a top-level comment on the video).
- A reply can be posted to any comment, at any depth — this naturally forms a tree.
- The UI indents each level of reply and shows a connecting line to its parent, so the conversation structure is always visually clear.
- Long threads should support collapse/expand.

## 4. Data Model

```
Video {
  id
  youtube_video_id     // extracted from the pasted URL
  title
  added_by_user_id
  created_at
}

Comment {
  id
  video_id             // FK -> Video.id
  parent_comment_id    // FK -> Comment.id, null if top-level
  author_id            // FK -> User.id
  type                 // "text" | "video"
  text_content         // used when type = "text"
  video_url            // used when type = "video" (stored in Cloudinary/Supabase Storage)
  timestamp_seconds     // nullable; set if this comment is anchored to a moment in the video
  created_at
  likes_count
}

User {
  id
  username
  avatar_url
  created_at
}
```

Notes:
- `parent_comment_id` is the single relationship that enables unlimited-depth threading.
- `timestamp_seconds` is independent of threading — both a top-level comment and a reply can carry a timestamp.
- Only `Comment.video_url` involves storing actual video files (short user comment clips) — never the main YouTube video.

## 5. API Endpoints (suggested)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/videos` | List videos added to the platform |
| POST | `/api/videos` | Add a video by YouTube URL |
| GET | `/api/videos/:id/comments` | Get threaded comments for a video (tree or flat + parent_id, client builds tree) |
| POST | `/api/comments` | Create a comment (text or video, optional parent_id, optional timestamp_seconds) |
| POST | `/api/comments/:id/like` | Like a comment |
| POST | `/api/upload/video-comment` | Upload a video comment clip to storage, returns a URL to attach to a comment |

## 6. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Video playback | YouTube IFrame Player API | Free, no hosting needed, gives playback time for timestamps |
| Frontend | Next.js + Tailwind CSS | Fast to build, good component structure, free hosting on Vercel |
| Backend / DB / Auth | Supabase (Postgres + Auth + Storage) | One free service covers database, authentication, and file storage |
| Video comment storage | Cloudinary | Free tier, built-in video compression & thumbnail generation |
| Hosting | Vercel (frontend) + Supabase (backend) | Free tiers suitable for development and demo |

## 7. Non-Functional Notes
- Responsive layout (desktop + mobile).
- Free-tier services above are suitable for development/demo; a production launch with real traffic would need paid tiers on Supabase and/or Cloudinary (see `SCOPE.md`).
