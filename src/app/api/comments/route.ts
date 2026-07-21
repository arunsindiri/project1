import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    video_id,
    parent_comment_id = null,
    author_id = "anonymous",
    type,
    text_content = null,
    video_url = null,
    timestamp_seconds = null,
  } = body;

  if (!video_id || !type) {
    return NextResponse.json({ error: "video_id and type are required" }, { status: 400 });
  }

  if (type === "text" && !text_content) {
    return NextResponse.json({ error: "text_content is required for text comments" }, { status: 400 });
  }

  if (type === "video" && !video_url) {
    return NextResponse.json({ error: "video_url is required for video comments" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      video_id,
      parent_comment_id,
      author_id,
      type,
      text_content,
      video_url,
      timestamp_seconds,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase insert error:", JSON.stringify(error, null, 2));
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
