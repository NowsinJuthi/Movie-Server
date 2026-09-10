"use client";

import { CatalogTermsPage } from "@/components/admin/catalog-terms-page";

export default function AdminGenresPage() {
  return (
    <CatalogTermsPage
      kind="genres"
      title="Genres"
      description="Canonical genre list used for homepage rows and filters. Built-in genres are seeded automatically."
    />
  );
}
