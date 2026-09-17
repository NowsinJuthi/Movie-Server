"use client";

import { useEffect, useMemo, useState } from "react";

export function PosterImage({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setRetry(0);
  }, [src]);

  const displaySrc = useMemo(() => {
    if (!src || retry === 0) {
      return src;
    }
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}retry=${retry}`;
  }, [src, retry]);

  if (!displaySrc) {
    return <div className={className} aria-hidden />;
  }

  return (
    // Artwork is cookie-authenticated; the Next optimizer cannot send the session cookie.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={displaySrc}
      src={displaySrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => {
        if (retry < 1) {
          setRetry((value) => value + 1);
        }
      }}
    />
  );
}
