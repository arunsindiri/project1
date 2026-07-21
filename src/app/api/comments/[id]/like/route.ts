import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const commentId = params.id;

  const { data, error } = await supabase
    .from("comments")
    .select("likes_count")
    .eq("id", commentId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("comments")
    .update({ likes_count: (data.likes_count ?? 0) + 1 })
    .eq("id", commentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ likes_count: (data.likes_count ?? 0) + 1 });
}
