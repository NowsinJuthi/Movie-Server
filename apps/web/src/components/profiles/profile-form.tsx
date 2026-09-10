"use client";

import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  LANGUAGE_LABELS,
  MATURITY_LEVELS,
  PRESET_AVATARS,
  PROFILE_LANGUAGES,
  SUBTITLE_LANGUAGES,
  type PublicProfile,
} from "@movie-server/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileAvatar, avatarColor } from "@/components/profiles/profile-avatar";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1).max(20),
  avatarKey: z.string(),
  isKids: z.boolean(),
  language: z.string(),
  audioLanguage: z.string(),
  subtitleLanguage: z.string(),
  maturityLevel: z.string(),
  pin: z.union([z.literal(""), z.string().regex(/^\d{4}$/)]).optional(),
});

export type ProfileFormValues = z.infer<typeof schema>;

export function ProfileForm({
  profile,
  submitLabel,
  onSubmit,
  onAvatarFile,
  busy,
}: {
  profile?: PublicProfile;
  submitLabel: string;
  onSubmit: (values: ProfileFormValues) => void;
  onAvatarFile?: (file: File) => void;
  busy?: boolean;
}) {
  const router = useRouter();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: profile?.name ?? "",
      avatarKey: profile?.avatarKey ?? PRESET_AVATARS[0],
      isKids: profile?.isKids ?? false,
      language: profile?.language ?? "en",
      audioLanguage: profile?.audioLanguage ?? "en",
      subtitleLanguage: profile?.subtitleLanguage ?? "off",
      maturityLevel: profile?.maturityLevel ?? "mature",
      pin: "",
    },
  });

  const values = form.watch();

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <ProfileAvatar
          profile={{
            name: values.name || "P",
            avatarKey: values.avatarKey,
            avatarUrl: profile?.avatarUrl ?? null,
          }}
        />
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" maxLength={20} {...form.register("name")} />
          {onAvatarFile ? (
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onAvatarFile(file);
                }
              }}
            />
          ) : null}
        </div>
      </div>

      <div>
        <Label>Avatar</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_AVATARS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => form.setValue("avatarKey", key)}
              className={cn(
                "h-10 w-10 rounded-md",
                avatarColor(key),
                values.avatarKey === key ? "ring-2 ring-white" : "opacity-70",
              )}
              aria-label={key}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register("isKids")} />
        Kids profile
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldSelect label="Language" options={PROFILE_LANGUAGES} register={form.register("language")} labels={LANGUAGE_LABELS} />
        <FieldSelect label="Audio language" options={PROFILE_LANGUAGES} register={form.register("audioLanguage")} labels={LANGUAGE_LABELS} />
        <FieldSelect label="Subtitles" options={SUBTITLE_LANGUAGES} register={form.register("subtitleLanguage")} labels={LANGUAGE_LABELS} />
        <FieldSelect
          label="Maturity"
          options={MATURITY_LEVELS}
          register={form.register("maturityLevel")}
          labels={{ kids: "Kids", teens: "Teens", mature: "Mature" }}
        />
      </div>

      {!profile ? (
        <div className="space-y-2">
          <Label htmlFor="pin">PIN (optional)</Label>
          <Input id="pin" inputMode="numeric" maxLength={4} placeholder="4 digits" {...form.register("pin")} />
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FieldSelect({
  label,
  options,
  register,
  labels,
}: {
  label: string;
  options: readonly string[];
  register: UseFormRegisterReturn;
  labels: Record<string, string>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        {...register}
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {labels[value] ?? value}
          </option>
        ))}
      </select>
    </div>
  );
}
