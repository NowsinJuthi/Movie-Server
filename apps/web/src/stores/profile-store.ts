import { create } from "zustand";
import type { PublicProfile } from "@movie-server/shared";

type ProfileState = {
  profiles: PublicProfile[];
  activeProfile: PublicProfile | null;
  setProfiles: (profiles: PublicProfile[]) => void;
  setActiveProfile: (profile: PublicProfile | null) => void;
  clear: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  activeProfile: null,
  setProfiles: (profiles) => set({ profiles }),
  setActiveProfile: (activeProfile) => set({ activeProfile }),
  clear: () => set({ profiles: [], activeProfile: null }),
}));
