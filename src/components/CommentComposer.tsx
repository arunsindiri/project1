"use client";

import { useState, useRef } from "react";
import { uploadVideoComment } from "@/lib/cloudinary";

interface CommentComposerProps {
  videoId: string;
  parentId?: string | null;
  currentTimestamp?: number | null;
  onSubmit: (comment: {
    type: "text" | "video";
    text_content?: string;
    video_url?: string;
    parent_comment_id?: string | null;
    timestamp_seconds?: number | null;
  }) => void;
}

export default function CommentComposer({
  videoId,
  parentId = null,
  currentTimestamp,
  onSubmit,
}: CommentComposerProps) {
  const [mode, setMode] = useState<"text" | "video">("text");
  const [text, setText] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useTimestamp, setUseTimestamp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  function handleRemoveVideo() {
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (mode === "text" && !text.trim()) return;
    if (mode === "video" && !videoFile) return;

    setUploading(true);

    try {
      if (mode === "video" && videoFile) {
        const videoUrl = await uploadVideoComment(videoFile);
        onSubmit({
          type: "video",
          video_url: videoUrl,
          parent_comment_id: parentId,
          timestamp_seconds: useTimestamp ? currentTimestamp ?? null : null,
        });
      } else {
        onSubmit({
          type: "text",
          text_content: text,
          parent_comment_id: parentId,
          timestamp_seconds: useTimestamp ? currentTimestamp ?? null : null,
        });
      }

      setText("");
      handleRemoveVideo();
      setUseTimestamp(false);
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setMode("text")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            mode === "text"
              ? "bg-black text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Text
        </button>
        <button
          onClick={() => setMode("video")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            mode === "video"
              ? "bg-black text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Video
        </button>
      </div>

      {mode === "text" ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-gray-400 focus:outline-none"
        />
      ) : (
        <div>
          {!videoPreview ? (
            <label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-gray-300 p-6 transition hover:border-gray-400 hover:bg-gray-50">
              <svg
                className="mb-2 h-10 w-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm text-gray-500">
                Click to upload a short video clip
              </span>
              <span className="mt-1 text-xs text-gray-400">
                MP4, WebM, MOV — max 60s recommended
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative">
              <video
                src={videoPreview}
                controls
                className="w-full rounded-lg"
              />
              <button
                onClick={handleRemoveVideo}
                className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white transition hover:bg-black"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {videoPreview && (
            <p className="mt-2 truncate text-xs text-gray-500">
              {videoFile?.name}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={useTimestamp}
            onChange={(e) => setUseTimestamp(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Pin to timestamp
          {useTimestamp && currentTimestamp != null && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {Math.floor(currentTimestamp / 60)}:
              {String(Math.floor(currentTimestamp % 60)).padStart(2, "0")}
            </span>
          )}
        </label>

        <button
          onClick={handleSubmit}
          disabled={
            uploading ||
            (mode === "text" && !text.trim()) ||
            (mode === "video" && !videoFile)
          }
          className="rounded-full bg-blue-600 px-5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? "Posting..." : "Comment"}
        </button>
      </div>
    </div>
  );
}
