export async function uploadVideoComment(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    console.log("Cloudinary cloud name:", cloudName);
    console.log("Upload preset:", "video_comments");
    console.log("File:", file.name, file.type, file.size);

    if (!cloudName) {
      reject(new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set"));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "video_comments");

    const url = `https://api.cloudinary.com/v1_/${cloudName}/video/upload`;
    console.log("Upload URL:", url);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      console.log("Cloudinary response:", xhr.status, xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch {
          reject(new Error("Invalid response from Cloudinary"));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const data = JSON.parse(xhr.responseText);
          message = data.error?.message ?? message;
        } catch {}
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      console.error("XHR error - URL:", url);
      reject(new Error("Network error — check your connection or Cloudinary upload preset"));
    };
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(formData);
  });
}
