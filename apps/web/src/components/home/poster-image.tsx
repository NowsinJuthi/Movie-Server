"use client";

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
  if (!src) {
    return <div className={className} aria-hidden />;
  }
  return (
    // Artwork is cookie-authenticated; the Next optimizer cannot send the session cookie.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "low"}
      draggable={false}
    />
  );
}
