export const RAG_COLORS = {
  green: "#10b981",
  orange: "#f59e0b",
  red: "#ef4444",
  gray: "#e5e7eb",
} as const;

export const RAG_LABELS: Record<string, string> = {
  green: "Disponible",
  orange: "Chargé",
  red: "Surchargé",
  gray: "Non alloué",
};

export type RAGStatus = "green" | "orange" | "red" | "gray";

export function getRAGStatus(chargePct: number): RAGStatus {
  if (chargePct <= 0) return "gray";
  if (chargePct < 80) return "green";
  if (chargePct <= 100) return "orange";
  return "red";
}

export function getRAGColor(chargePct: number): string {
  return RAG_COLORS[getRAGStatus(chargePct)];
}

export const MOIS_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
] as const;

export const MOIS_LABELS_FULL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
] as const;
