"use client";

import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface UseYouTubePlayerReturn {
  playerReady: boolean;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  onTimeUpdate: (callback: (time: number) => void) => void;
  removeTimeUpdateListener: (callback: (time: number) => void) => void;
}

export default function useYouTubePlayer(
  containerId: string,
  videoId: string
): UseYouTubePlayerReturn {
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<any>(null);
  const timeUpdateListenersRef = useRef<Set<(time: number) => void>>(new Set());
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          controls: 1,
        },
        events: {
          onReady: () => {
            setPlayerReady(true);
            timeUpdateIntervalRef.current = setInterval(() => {
              if (playerRef.current?.getCurrentTime) {
                const time = playerRef.current.getCurrentTime();
                timeUpdateListenersRef.current.forEach((cb) => cb(time));
              }
            }, 250);
          },
        },
      });
    };

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [containerId, videoId]);

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
    }
  }, []);

  const getCurrentTime = useCallback(() => {
    return playerRef.current?.getCurrentTime?.() ?? 0;
  }, []);

  const getDuration = useCallback(() => {
    return playerRef.current?.getDuration?.() ?? 0;
  }, []);

  const onTimeUpdate = useCallback(
    (callback: (time: number) => void) => {
      timeUpdateListenersRef.current.add(callback);
    },
    []
  );

  const removeTimeUpdateListener = useCallback(
    (callback: (time: number) => void) => {
      timeUpdateListenersRef.current.delete(callback);
    },
    []
  );

  return {
    playerReady,
    seekTo,
    getCurrentTime,
    getDuration,
    onTimeUpdate,
    removeTimeUpdateListener,
  };
}
