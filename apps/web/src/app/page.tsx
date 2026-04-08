"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const key = "__retina_root_redirect";
    if (sessionStorage.getItem(key)) {
      sessionStorage.removeItem(key);
      router.replace("/login");
      return;
    }
    sessionStorage.setItem(key, "1");
    window.location.href = "/";
  }, [router]);

  return null;
}
