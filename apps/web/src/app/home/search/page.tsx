import { Suspense } from "react";
import { SearchPageClient } from "./search-client";
import { ScreenMessage } from "@/components/profiles/pin-dialog";

export default function SearchPage() {
  return (
    <Suspense fallback={<ScreenMessage>Loading search...</ScreenMessage>}>
      <SearchPageClient />
    </Suspense>
  );
}
