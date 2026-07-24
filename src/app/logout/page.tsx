"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function LogoutPage() {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.signOut().then(() => {
      window.location.href = "/";
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-500">Signing out...</p>
    </div>
  );
}
