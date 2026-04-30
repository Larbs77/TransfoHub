"use client";

import { useEffect, useState } from "react";
import { getRmdsForSelect } from "@/app/(app)/actions";
import { MultiSelect } from "@/components/ui/multi-select";

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export function RmdMultiSelect({ selected, onChange, className }: Props) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    getRmdsForSelect().then((rmds) =>
      setOptions(rmds.map((r) => ({ value: r.id, label: r.nom_complet })))
    );
  }, []);

  return (
    <MultiSelect
      options={options}
      selected={selected}
      onChange={onChange}
      placeholder="RMD"
      className={className}
    />
  );
}
