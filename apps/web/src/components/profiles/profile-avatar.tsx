import { PRESET_AVATARS, type PublicProfile } from "@movie-server/shared";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "bg-red-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-violet-600",
  "bg-pink-600",
  "bg-cyan-600",
  "bg-orange-600",
];

export function avatarColor(key: string): string {
  const index = Math.max(0, PRESET_AVATARS.indexOf(key as (typeof PRESET_AVATARS)[number]));
  return PRESET_COLORS[index % PRESET_COLORS.length];
}

export function ProfileAvatar({
  profile,
  size = "lg",
}: {
  profile: Pick<PublicProfile, "name" | "avatarKey" | "avatarUrl">;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "h-10 w-10 text-sm" : size === "md" ? "h-20 w-20 text-2xl" : "h-32 w-32 text-4xl";
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt={profile.name}
        className={cn("rounded-md object-cover", dim)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md font-semibold text-white",
        dim,
        avatarColor(profile.avatarKey),
      )}
    >
      {profile.name.slice(0, 1).toUpperCase()}
    </div>
  );
}
