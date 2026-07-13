import { notFound } from "next/navigation";
import { getRaidDetail } from "./actions";
import { getRessourcesForSelect } from "@/app/(app)/actions";
import { RaidDetailClient } from "@/components/raid-detail-client";
import { AccessDenied } from "@/components/access-denied";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RaidDetailPage({ params }: Props) {
  const { id } = await params;

  let payload;
  try {
    payload = await getRaidDetail(id);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.toLowerCase().includes("non autorisé")) {
      return (
        <AccessDenied message="Vous n'avez pas accès à cette entrée RAID." />
      );
    }
    throw e;
  }

  if (!payload) return notFound();

  let ressources: {
    id: string;
    nom_complet: string;
    organisation: string;
  }[] = [];
  try {
    ressources = await getRessourcesForSelect();
  } catch {
    ressources = [];
  }

  // Serialize dates for the client component
  const raid = JSON.parse(JSON.stringify(payload.raid));

  return (
    <RaidDetailClient
      raid={raid}
      canCollaborate={payload.canCollaborate}
      currentUser={payload.currentUser}
      ressources={ressources}
    />
  );
}
