"use client";

interface TimestampMarkerProps {
  seconds: number;
  duration: number;
  commentText?: string;
  commentId?: string;
  onClick: (seconds: number) => void;
}

export default function TimestampMarker({
  seconds,
  duration,
  commentText,
  onClick,
}: TimestampMarkerProps) {
  if (duration <= 0) return null;

  const percent = (seconds / duration) * 100;
  const timeLabel = `${Math.floor(seconds / 60)}:${String(
    Math.floor(seconds % 60)
  ).padStart(2, "0")}`;

  return (
    <button
      onClick={() => onClick(seconds)}
      title={`${timeLabel}${commentText ? ` — ${commentText}` : ""}`}
      className="absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 transition hover:scale-150 hover:bg-blue-600"
      style={{ left: `${percent}%` }}
    />
  );
}
