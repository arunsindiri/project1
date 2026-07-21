export async function uploadVideoComment(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "video_comments");

  const res = await fetch(
    `https://api.cloudinary.com/v1_/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url;
}
