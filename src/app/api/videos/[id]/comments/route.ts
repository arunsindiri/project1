import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?video_id=eq.${encodeURIComponent(videoId)}&order=created_at.asc&select=id,video_id,parent_comment_id,author_id,type,text_content,video_url,timestamp_seconds,created_at,likes_count`;

  const res = await fetch(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
