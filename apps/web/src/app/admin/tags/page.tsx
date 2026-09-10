"use client";

import { CatalogTermsPage } from "@/components/admin/catalog-terms-page";

export default function AdminTagsPage() {
  return (
    <CatalogTermsPage
      kind="tags"
      title="Tags"
      description="Reusable tags for movies and series. Delete is blocked while a tag is still in use."
    />
  );
}
