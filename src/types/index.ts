export interface User {
  id: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

export interface Video {
  id: string;
  youtube_video_id: string;
  title: string;
  added_by_user_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  video_id: string;
  parent_comment_id: string | null;
  author_id: string;
  type: "text" | "video";
  text_content: string | null;
  video_url: string | null;
  timestamp_seconds: number | null;
  created_at: string;
  likes_count: number;
  author?: User;
  replies?: Comment[];
}
