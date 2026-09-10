"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function LazyMount({ children, eager = false }: { children: ReactNode; eager?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (eager || visible) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, visible]);

  if (eager || visible) {
    return <>{children}</>;
  }
  return <div ref={ref} className="h-48" aria-hidden />;
}
