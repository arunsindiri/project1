import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Cloudinary not configured" },
      { status: 500 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `timestamp=${timestamp}`;
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(paramsToSign)
    .digest("hex");

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", apiKey);
  uploadForm.append("timestamp", String(timestamp));
  uploadForm.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_/${cloudName}/video/upload`,
    { method: "POST", body: uploadForm }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error("Cloudinary upload error:", res.status, data);
    return NextResponse.json(
      { error: data.error?.message ?? "Upload failed" },
      { status: 500 }
    );
  }

  const data = await res.json();
  return NextResponse.json({ url: data.secure_url });
}
