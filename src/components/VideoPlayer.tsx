"use client";

import { useEffect } from "react";
import useYouTubePlayer from "@/hooks/useYouTubePlayer";

interface VideoPlayerProps {
  videoId: string;
  onPlayerReady?: (player: {
    seekTo: (seconds: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    onTimeUpdate: (callback: (time: number) => void) => void;
    removeTimeUpdateListener: (callback: (time: number) => void) => void;
  }) => void;
}

export default function VideoPlayer({ videoId, onPlayerReady }: VideoPlayerProps) {
  const containerId = `yt-player-${videoId}`;

  const player = useYouTubePlayer(containerId, videoId);

  useEffect(() => {
    if (player.playerReady && onPlayerReady) {
      onPlayerReady(player);
    }
  }, [player.playerReady, onPlayerReady, player]);

  return (
    <div className="relative w-full">
      <div id={containerId} className="aspect-video w-full rounded-xl bg-black" />
    </div>
  );
}
