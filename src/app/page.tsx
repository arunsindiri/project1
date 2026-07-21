import Link from "next/link";

const DEMO_VIDEOS = [
  { id: "1", youtube_video_id: "dQw4w9WgXcQ", title: "Demo Video 1", views: "1.2M" },
  { id: "2", youtube_video_id: "oHg5SJYRHA0", title: "Demo Video 2", views: "890K" },
  { id: "3", youtube_video_id: "9bZkp7q19f0", title: "Demo Video 3", views: "2.1M" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-semibold">Trending</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_VIDEOS.map((video) => (
            <Link
              key={video.id}
              href={`/watch?id=${video.youtube_video_id}`}
              className="group"
            >
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-gray-200">
                <img
                  src={`https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`}
                  alt={video.title}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="mt-2">
                <h3 className="text-sm font-medium">{video.title}</h3>
                <p className="text-xs text-gray-500">{video.views} views</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
