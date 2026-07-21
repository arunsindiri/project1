"use client";

import Link from "next/link";

export default function Navbar() {
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
        <Link
          href="/auth"
          className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Sign In
        </Link>
      </div>
    </nav>
  );
}
