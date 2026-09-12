"use client";

import { useEffect, useState } from "react";

/** Touch-first layout for phone/tablet player chrome (Emby-style). */
export function useMobilePlayerLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return mobile;
}
