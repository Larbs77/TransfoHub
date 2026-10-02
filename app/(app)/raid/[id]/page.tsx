import { notFound } from "next/navigation";
import { getRaidDetail } from "./actions";
import {
  getRaidFieldOptions,
  getRessourcesForSelect,
  getStatusConfigs,
} from "@/app/(app)/actions";
import { RaidDetailClient } from "@/components/raid-detail-client";
import { AccessDenied } from "@/components/access-denied";
import { sanitizeRaidReturnTo } from "@/lib/raid-list-query";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function RaidDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const returnTo = sanitizeRaidReturnTo(sp.from ?? null);

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
  let statusConfigs: Awaited<ReturnType<typeof getStatusConfigs>> = [];
  let fieldOptions: Awaited<ReturnType<typeof getRaidFieldOptions>> = [];
  try {
    [ressources, statusConfigs, fieldOptions] = await Promise.all([
      getRessourcesForSelect(),
      getStatusConfigs(),
      getRaidFieldOptions(),
    ]);
  } catch {
    ressources = [];
  }

  const raid = JSON.parse(JSON.stringify(payload.raid));

  return (
    <RaidDetailClient
      raid={raid}
      canCollaborate={payload.canCollaborate}
      canAssign={payload.canAssign}
      canEdit={payload.canEdit}
      canComment={payload.canComment}
      canShare={payload.canShare}
      accessViaShareOnly={payload.accessViaShareOnly}
      mentionCandidates={payload.mentionCandidates}
      shareTargets={payload.shareTargets}
      currentUser={payload.currentUser}
      ressources={ressources}
      statusConfigs={statusConfigs}
      fieldOptions={fieldOptions}
      returnTo={returnTo}
      nowMs={Date.now()}
    />
  );
}
