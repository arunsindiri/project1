import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const maxDuration = 60;

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 413 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const b64 = Buffer.from(arrayBuf).toString("base64");
    const dataUri = `data:${file.type};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: "video",
      folder: "video_comments",
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
