"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import TimestampMarker from "@/components/TimestampMarker";
import CommentComposer from "@/components/CommentComposer";
import type { Comment } from "@/types";

function CommentItem({
  comment,
  onSubmit,
  seekTo,
}: {
  comment: Comment;
  onSubmit: (c: {
    type: "text" | "video";
    text_content?: string;
    video_url?: string;
    parent_comment_id?: string | null;
    timestamp_seconds?: number | null;
  }) => void;
  seekTo: (seconds: number) => void;
}) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const hasReplies = comment.replies && comment.replies.length > 0;
  const isVideo = comment.type === "video";

  return (
    <div className="py-3">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-300" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {comment.author?.username ?? "user"}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
            {comment.timestamp_seconds != null && (
              <button
                onClick={() => seekTo(comment.timestamp_seconds!)}
                className="cursor-pointer rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
              >
                {Math.floor(comment.timestamp_seconds / 60)}:
                {String(Math.floor(comment.timestamp_seconds % 60)).padStart(
                  2,
                  "0"
                )}
              </button>
            )}
          </div>

          {isVideo ? (
            <div className="mt-2">
              <video
                src={comment.video_url ?? ""}
                controls
                className="w-full max-w-sm rounded-lg"
              />
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-700">{comment.text_content}</p>
          )}

          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <button className="flex items-center gap-1 hover:text-gray-700">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017a2 2 0 01-.95-.24l-3.296-1.83V11l4.474-6.712A2 2 0 0112.678 3h.064a2 2 0 011.958 1.5L14 10z"
                />
              </svg>
              {comment.likes_count}
            </button>
            <button
              onClick={() => setShowReplyBox(!showReplyBox)}
              className="hover:text-gray-700"
            >
              Reply
            </button>
          </div>

          {showReplyBox && (
            <div className="mt-3">
              <CommentComposer
                videoId={comment.video_id}
                parentId={comment.id}
                onSubmit={(c) => {
                  onSubmit(c);
                  setShowReplyBox(false);
                }}
              />
            </div>
          )}

          {hasReplies && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {showReplies ? "Hide" : "Show"} {comment.replies!.length}{" "}
              {comment.replies!.length === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>

      {hasReplies && showReplies && (
        <div className="ml-12 border-l-2 border-gray-100 pl-4">
          {comment.replies!.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onSubmit={onSubmit}
              seekTo={seekTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function buildTree(comments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  comments.forEach((c) => map.set(c.id, { ...c, replies: [] }));
  comments.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_comment_id && map.has(c.parent_comment_id)) {
      map.get(c.parent_comment_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const VIDEO_ID = "dQw4w9WgXcQ";

export default function WatchPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const tree = buildTree(comments);
  const [currentTimestamp] = useState<number | null>(30);

  const [playerReady, setPlayerReady] = useState(false);
  const [seekTo, setSeekTo] = useState<((seconds: number) => void) | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const seekToRef = useRef<((seconds: number) => void) | null>(null);

  const handlePlayerReady = useCallback(
    (player: {
      seekTo: (seconds: number) => void;
      getCurrentTime: () => number;
      getDuration: () => number;
      onTimeUpdate: (callback: (time: number) => void) => void;
    }) => {
      setPlayerReady(true);
      setSeekTo(() => player.seekTo);
      seekToRef.current = player.seekTo;

      const updateTime = (time: number) => setCurrentTime(time);
      player.onTimeUpdate(updateTime);

      const pollDuration = setInterval(() => {
        const d = player.getDuration();
        if (d > 0) {
          setDuration(d);
          clearInterval(pollDuration);
        }
      }, 500);
    },
    []
  );

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/${VIDEO_ID}/comments`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleNewComment(c: {
    type: "text" | "video";
    text_content?: string;
    video_url?: string;
    parent_comment_id?: string | null;
    timestamp_seconds?: number | null;
  }) {
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: VIDEO_ID,
          type: c.type,
          text_content: c.text_content ?? null,
          video_url: c.video_url ?? null,
          parent_comment_id: c.parent_comment_id ?? null,
          timestamp_seconds: c.timestamp_seconds ?? null,
        }),
      });

      const data = await res.json();
      console.log("POST /api/comments:", res.status, data);

      if (res.ok) {
        setComments((prev) => [...prev, data]);
      } else {
        console.error("Comment failed:", data);
      }
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
  }

  function handleSeekTo(seconds: number) {
    if (seekToRef.current) {
      seekToRef.current(seconds);
    }
  }

  const timestampComments = comments.filter(
    (c) => c.timestamp_seconds != null && c.parent_comment_id === null
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <VideoPlayer videoId={VIDEO_ID} onPlayerReady={handlePlayerReady} />

        {playerReady && duration > 0 && (
          <div className="relative mt-2 h-6 w-full select-none">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-200"
                style={{
                  width: `${(currentTime / duration) * 100}%`,
                }}
              />
            </div>

            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2">
              {timestampComments.map((c) => (
                <TimestampMarker
                  key={c.id}
                  seconds={c.timestamp_seconds!}
                  duration={duration}
                  commentText={c.text_content ?? undefined}
                  onClick={handleSeekTo}
                />
              ))}
            </div>

            <div className="absolute inset-x-0 -bottom-3 flex justify-between text-[10px] text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h1 className="text-xl font-semibold">Demo Video Title</h1>
          <p className="mt-1 text-sm text-gray-500">1,234 views · Jul 20, 2026</p>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-lg font-medium">
            Comments · {comments.length}
          </h2>
          <CommentComposer
            videoId={VIDEO_ID}
            currentTimestamp={currentTimestamp}
            onSubmit={handleNewComment}
          />

          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading comments...</p>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {tree.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onSubmit={handleNewComment}
                  seekTo={handleSeekTo}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
