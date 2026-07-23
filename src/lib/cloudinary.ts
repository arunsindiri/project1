export async function uploadVideoComment(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (onProgress) onProgress(0);

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload/video-comment", {
    method: "POST",
    body: formData,
  });

  if (onProgress) onProgress(100);

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Upload failed");
  }

  return data.url;
}
