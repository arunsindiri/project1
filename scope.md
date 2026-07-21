# Project Scope

## 1. In Scope

- A web interface in the style of YouTube (not a pixel-exact clone).
- **Embedding real YouTube videos** via the YouTube IFrame Player API — videos are added by pasting a YouTube URL/ID.
- A custom **comment system** on each video, supporting:
  - Text comments
  - Video comments (short user-recorded/uploaded clips)
  - Comments anchored to a specific **timestamp** in the video
  - **Threaded/nested replies** (tree structure, not flat)
- Basic supporting pages: Home feed, Watch page, Channel page, Search, Auth (sign up/log in).
- Responsive design for desktop and mobile.

## 2. Out of Scope (for this phase)

- **Hosting, uploading, transcoding, or streaming the main video content.** This project does not build a video hosting pipeline — that responsibility stays with YouTube. Only the comment system stores files (short video comment clips), never full-length videos.
- Live streaming / live chat.
- Monetization (ads, memberships, Super Chat equivalents).
- Recommendation algorithm / personalized feed.
- Native mobile apps (this is a web interface only, though responsive).
- Content moderation tooling beyond basic reporting (can be scoped as a future phase if needed).

## 3. Why This Scope

The client's direction narrows this project specifically to **the comment experience**, not video hosting:
- Real YouTube videos are embedded, so video storage/streaming/bandwidth costs and complexity are avoided entirely.
- The team's engineering effort goes into the part that's actually new: text + video comments, timestamp-anchored comments, and threaded conversations.

## 4. Build Phases

| Phase | Deliverable |
|---|---|
| 1 | Base app: video embedding via pasted YouTube URL, basic auth, home/watch/channel pages |
| 2 | Text comments with full threading (nested replies, likes) |
| 3 | Video comments (record/upload short clips as replies) with inline playback |
| 4 | Timestamp comments (anchor comment to playback time, markers on scrubber, click-to-seek) |
| 5 | Polish: responsive styling, collapse/expand threads, pagination |

## 5. Open Questions to Confirm with Client

1. Is there a maximum length for a video comment (e.g. 30–60 seconds)?
2. Can a video comment be replied to with another video, or text-only replies beneath a video comment?
3. Who can add videos to the platform — any user, or admin/moderators only?
4. Should timestamp comments be visible to everyone by default, or opt-in per comment?

## 6. Cost Note

The proposed tech stack (Next.js, Supabase, Cloudinary, Vercel, YouTube IFrame API) is free at development and demo scale. At real production traffic, Supabase and Cloudinary each have paid tiers that would likely be needed — this is a future consideration, not a blocker for building and launching this phase.
