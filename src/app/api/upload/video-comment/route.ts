import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let res: Response;
    try {
      res = await fetch(
        `https://api.cloudinary.com/v1_/${cloudName}/video/upload`,
        { method: "POST", body: uploadForm, signal: controller.signal }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      const msg =
        fetchErr instanceof DOMException && fetchErr.name === "AbortError"
          ? "Upload timed out"
          : "Failed to reach Cloudinary";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    clearTimeout(timeout);

    const rawText = await res.text();

    if (!res.ok) {
      console.error("Cloudinary error:", res.status, rawText.slice(0, 500));
      let message = `Upload failed (${res.status})`;
      try {
        const parsed = JSON.parse(rawText);
        message = parsed.error?.message ?? message;
      } catch {}
      return NextResponse.json(
        { error: message },
        { status: 502 }
      );
    }

    let data: { secure_url?: string };
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Cloudinary returned non-JSON:", rawText.slice(0, 200));
      return NextResponse.json(
        { error: "Cloudinary returned an invalid response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: data.secure_url });
  } catch (err) {
    console.error("Upload route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
