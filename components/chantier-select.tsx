"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChantierOption {
  id: string;
  code: string;
  nom: string;
}

interface Props {
  chantiers: ChantierOption[];
  value: string;
  onValueChange: (value: string) => void;
}

export function ChantierSelect({ chantiers, value, onValueChange }: Props) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Sélectionner un chantier" />
      </SelectTrigger>
      <SelectContent>
        {chantiers.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.code} - {c.nom}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
