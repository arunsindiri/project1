import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = "video_comments";

  if (!cloudName) {
    return NextResponse.json(
      { error: "Cloudinary not configured" },
      { status: 500 }
    );
  }

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("upload_preset", uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_/${cloudName}/video/upload`,
    { method: "POST", body: uploadForm }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("Cloudinary server upload error:", res.status, data);
    return NextResponse.json(
      { error: data.error?.message ?? "Upload failed" },
      { status: 500 }
    );
  }

  const data = await res.json();
  return NextResponse.json({ url: data.secure_url });
}
