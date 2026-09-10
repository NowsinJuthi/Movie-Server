import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground">Your account does not have permission for that area.</p>
      <Button asChild>
        <Link href="/app">Return to library</Link>
      </Button>
    </main>
  );
}
