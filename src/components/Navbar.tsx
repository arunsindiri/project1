"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user, loading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <Link href="/" className="text-xl font-bold">
        VidTalk
      </Link>

      <div className="flex flex-1 justify-center">
        <input
          type="text"
          placeholder="Search"
          className="w-full max-w-md rounded-full border border-gray-300 px-4 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        ) : user ? (
          <div className="flex items-center gap-3">
            {user.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="avatar"
                className="h-8 w-8 rounded-full object-cover"
              />
            )}
            <button
              onClick={handleSignOut}
              className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            href="/auth"
            className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
