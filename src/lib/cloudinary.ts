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

  const text = await res.text();

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Server returned an invalid response. Please try again.");
  }

  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Upload failed"
    );
  }

  return data.url as string;
}
