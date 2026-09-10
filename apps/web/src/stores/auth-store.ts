import { create } from "zustand";
import type { PublicUser } from "@movie-server/shared";

type AuthState = {
  user: PublicUser | null;
  status: "idle" | "loading" | "authenticated" | "anonymous";
  setUser: (user: PublicUser | null) => void;
  setStatus: (status: AuthState["status"]) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  setUser: (user) => set({ user, status: user ? "authenticated" : "anonymous" }),
  setStatus: (status) => set({ status }),
  clear: () => set({ user: null, status: "anonymous" }),
}));
