import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    if (!cloudName) {
      return NextResponse.json(
        { error: "Cloudinary not configured" },
        { status: 500 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadForm = new FormData();
    uploadForm.append("file", new Blob([buffer], { type: file.type }), file.name);
    uploadForm.append("upload_preset", "video_comments");

    console.log(`Uploading ${file.name} (${file.type}, ${buffer.length} bytes) to Cloudinary...`);

    const res = await fetch(
      `https://api.cloudinary.com/v1_/${cloudName}/video/upload`,
      { method: "POST", body: uploadForm }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Cloudinary error:", res.status, JSON.stringify(data));
      return NextResponse.json(
        { error: data.error?.message ?? `Upload failed (${res.status})` },
        { status: 500 }
      );
    }

    console.log("Upload success:", data.secure_url);
    return NextResponse.json({ url: data.secure_url });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
