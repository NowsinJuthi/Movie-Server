import type { ReactNode } from "react";
import { HomeChrome } from "@/components/layout/home-chrome";

export default function SubscribeLayout({ children }: { children: ReactNode }) {
  return <HomeChrome requireAuth={false}>{children}</HomeChrome>;
}
