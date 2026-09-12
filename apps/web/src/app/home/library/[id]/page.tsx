import { Suspense } from "react";
import { ScreenMessage } from "@/components/profiles/pin-dialog";
import { LibraryBrowseClient } from "./library-browse-client";

export default function LibraryBrowsePage() {
  return (
    <Suspense fallback={<ScreenMessage>Loading library...</ScreenMessage>}>
      <LibraryBrowseClient />
    </Suspense>
  );
}
