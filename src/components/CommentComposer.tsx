"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  const [videoSource, setVideoSource] = useState<"upload" | "record">("upload");
  const [text, setText] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useTimestamp, setUseTimestamp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

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

  function handleRemoveRecording() {
    setRecordedBlob(null);
    setIsPreviewing(false);
    setRecordingTime(0);
  }

  async function startRecording() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecordedBlob(blob);
        setIsPreviewing(true);
        stopCamera();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      setCameraError(
        "Camera access denied. Please allow camera and microphone permissions."
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function getVideoBlob(): File | null {
    if (videoSource === "upload" && videoFile) return videoFile;
    if (videoSource === "record" && recordedBlob) {
      return new File([recordedBlob], `recording-${Date.now()}.webm`, {
        type: "video/webm",
      });
    }
    return null;
  }

  async function handleSubmit() {
    if (mode === "text" && !text.trim()) return;
    const blob = getVideoBlob();
    if (mode === "video" && !blob) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      if (mode === "video" && blob) {
        const videoUrl = await uploadVideoComment(blob, setUploadProgress);
        await onSubmit({
          type: "video",
          video_url: videoUrl,
          parent_comment_id: parentId,
          timestamp_seconds: useTimestamp ? currentTimestamp ?? null : null,
        });
      } else {
        await onSubmit({
          type: "text",
          text_content: text,
          parent_comment_id: parentId,
          timestamp_seconds: useTimestamp ? currentTimestamp ?? null : null,
        });
      }

      setText("");
      handleRemoveVideo();
      handleRemoveRecording();
      setUseTimestamp(false);
    } catch (err) {
      console.error("Failed to post comment:", err);
      setError(err instanceof Error ? err.message : "Failed to post comment. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const hasVideo =
    (videoSource === "upload" && videoFile) ||
    (videoSource === "record" && (isRecording || isPreviewing));

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
          {/* Upload / Record toggle */}
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => {
                setVideoSource("upload");
                handleRemoveRecording();
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                videoSource === "upload"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Upload
            </button>
            <button
              onClick={() => {
                setVideoSource("record");
                handleRemoveVideo();
              }}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                videoSource === "record"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Record
            </button>
          </div>

          {/* Upload mode */}
          {videoSource === "upload" && (
            <>
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
            </>
          )}

          {/* Record mode */}
          {videoSource === "record" && (
            <div className="flex flex-col items-center">
              {cameraError && (
                <p className="mb-2 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
                  {cameraError}
                </p>
              )}

              {!isPreviewing && (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full rounded-lg ${!isRecording ? "hidden" : ""}`}
                />
              )}

              {isPreviewing && recordedBlob && (
                <div className="relative w-full">
                  <video
                    src={URL.createObjectURL(recordedBlob)}
                    controls
                    className="w-full rounded-lg"
                  />
                  <button
                    onClick={handleRemoveRecording}
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

              {!isRecording && !isPreviewing && (
                <button
                  onClick={startRecording}
                  className="mt-4 flex items-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                >
                  <span className="h-3 w-3 rounded-full bg-white" />
                  Start Recording
                </button>
              )}

              {isRecording && (
                <div className="mt-3 flex items-center gap-4">
                  <span className="flex items-center gap-2 text-sm text-red-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    {formatTime(recordingTime)}
                  </span>
                  <button
                    onClick={stopRecording}
                    className="rounded-full bg-gray-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800"
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

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
            (mode === "video" && !getVideoBlob())
          }
          className="rounded-full bg-blue-600 px-5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? "Posting..." : "Comment"}
        </button>
      </div>
    </div>
  );
}
