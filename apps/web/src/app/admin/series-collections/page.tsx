"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { seriesApi } from "@/lib/series-api";

export default function AdminSeriesCollectionsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const query = useQuery({
    queryKey: ["admin-series-collections"],
    queryFn: seriesApi.adminCollections,
  });

  const create = useMutation({
    mutationFn: () => seriesApi.createCollection({ name, description: "" }),
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["admin-series-collections"] });
    },
  });

  return (
    <AdminPage title="Series collections" description="Group TV series for homepage rows and browse pages.">
      <div className="space-y-8">
        <form
          className="space-y-4 rounded-xl border border-border p-5"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Button type="submit">Create collection</Button>
        </form>
        <ul className="space-y-3">
          {(query.data?.collections ?? []).map((collection) => (
            <li key={collection.id} className="rounded-xl border border-border px-4 py-3">
              <p className="font-medium">{collection.name}</p>
              <p className="text-sm text-muted-foreground">{collection.seriesCount} series</p>
            </li>
          ))}
        </ul>
      </div>
    </AdminPage>
  );
}
