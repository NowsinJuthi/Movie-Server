import type { ReactNode } from "react";
import { HomeChrome } from "@/components/layout/home-chrome";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <HomeChrome>{children}</HomeChrome>;
}
