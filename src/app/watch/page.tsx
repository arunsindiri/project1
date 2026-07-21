"use client";

import { useState, useEffect, useCallback } from "react";
import CommentComposer from "@/components/CommentComposer";
import type { Comment } from "@/types";

function CommentItem({
  comment,
  onReply,
  onSubmit,
}: {
  comment: Comment;
  onReply: (parentId: string) => void;
  onSubmit: (c: {
    type: "text" | "video";
    text_content?: string;
    video_url?: string;
    parent_comment_id?: string | null;
    timestamp_seconds?: number | null;
  }) => void;
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
              <span className="cursor-pointer rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100">
                {Math.floor(comment.timestamp_seconds / 60)}:
                {String(Math.floor(comment.timestamp_seconds % 60)).padStart(
                  2,
                  "0"
                )}
              </span>
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
            <CommentItem key={reply.id} comment={reply} onReply={onReply} onSubmit={onSubmit} />
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

const VIDEO_ID = "dQw4w9WgXcQ";

export default function WatchPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const tree = buildTree(comments);
  const [currentTimestamp] = useState<number | null>(30);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="aspect-video w-full rounded-xl bg-black">
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/dQw4w9WgXcQ"
            title="Video Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-xl"
          />
        </div>

        <div className="mt-4">
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
                  onReply={(parentId) =>
                    handleNewComment({
                      type: "text",
                      text_content: "",
                      parent_comment_id: parentId,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
