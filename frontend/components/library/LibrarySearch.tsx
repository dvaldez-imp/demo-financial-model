"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import type { LibraryPremise } from "@/lib/types/api";

type LibrarySearchProps = {
  premises: LibraryPremise[];
  onResults: (results: LibraryPremise[]) => void;
};

export default function LibrarySearch({
  onResults,
  premises,
}: LibrarySearchProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      onResults(premises);
      return;
    }

    const filtered = premises.filter((premise) =>
      [premise.name, premise.category, premise.unit]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );

    onResults(filtered);
  }, [deferredQuery, onResults, premises]);

  return (
    <Input
      label="Buscar"
      placeholder="Gasolina, macro, Q/USD..."
      value={query}
      onChange={(event) => setQuery(event.target.value)}
    />
  );
}
