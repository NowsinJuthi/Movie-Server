import { redirect } from "next/navigation";

/** Root URL always sends visitors to sign-in (proxy also redirects authenticated users to /home). */
export default function RootPage() {
  redirect("/login");
}
