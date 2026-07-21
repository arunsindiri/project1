import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("comments")
    .select("id, video_id, parent_comment_id, author_id, type, text_content, video_url, timestamp_seconds, created_at, likes_count")
    .eq("video_id", videoId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
