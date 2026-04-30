import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { prisma } from "@/lib/prisma";
import { scoreCriticite } from "@/lib/utils-pmo";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY manquante dans les variables d'environnement.");
  }
  return new Groq({ apiKey });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message as string | undefined;
    const history = (body.history ?? []) as { role: string; content: string }[];

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Le champ 'message' est requis." },
        { status: 400 }
      );
    }

    // Récupérer le contexte PMO depuis la base
    const [chantiers, raids, comites, settings, jalons, adherences, consultationQuestions, favoris] = await Promise.all([
      prisma.chantier.findMany({ include: { _count: { select: { raids: true } } } }),
      prisma.raid.findMany({ include: { chantier: { select: { code: true, nom: true } } } }),
      prisma.comite.findMany({ orderBy: { date: "asc" } }),
      prisma.settings.findFirst({ where: { id: 1 } }),
      prisma.jalon.findMany({ include: { chantier: { select: { code: true, nom: true } } } }),
      prisma.adherence.findMany({ include: { chantierSource: { select: { code: true } }, chantierDependant: { select: { code: true } } } }),
      prisma.consultationQuestion.findMany({ include: { chantier: { select: { code: true } } } }),
      prisma.favoriChantier.findMany({ select: { chantierId: true } }),
    ]);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const fmtDate = (d: Date | null) => d ? new Date(d).toISOString().split("T")[0] : "—";

    const actions = raids.filter((r) => r.type === "Action");
    const risks = raids.filter((r) => r.type === "Risque");
    const decisions = raids.filter((r) => r.type === "Décision");
    const informations = raids.filter((r) => r.type === "Information");

    const activeActions = actions.filter((a) => !["Clôturé", "Abandonné"].includes(a.statut));
    const overdueActions = activeActions.filter((a) => a.date_echeance && a.date_echeance < now);

    // Build compact context to stay within Groq TPM limits
    const activeChantiers = chantiers.filter((c) => c.statut !== "Clôturé");
    const openRisks = risks.filter((r) => r.statut !== "Clos");
    const criticalRisks = openRisks.filter((r) => r.impact && r.probabilite && scoreCriticite(r.impact, r.probabilite) >= 12);
    const pendingDecisions = decisions.filter((d) => d.statut === "En attente");
    const upcomingComites = comites.filter((c) => c.date >= now);
    const favorisSet = new Set(favoris.map((f) => f.chantierId));

    // Jalons stats
    const jalonsEnRetard = jalons.filter((j) => new Date(j.date_cible) < now && !["Atteint", "Annulé"].includes(j.statut));
    const jalonsAtteints = jalons.filter((j) => j.statut === "Atteint");

    // Consultation Q&A stats
    const openQuestions = consultationQuestions.filter((q) => q.statut === "Ouverte" || q.statut === "En cours");
    const criticalOpenQuestions = openQuestions.filter((q) => q.priorite === "Critique");

    // Adherences stats
    const blockedAdherences = adherences.filter((a) => a.statut === "Bloqué");

    const contextePMO = `
## PMO Transformation Bancaire — ${todayStr}

### KPIs
Chantiers: ${activeChantiers.length}/${chantiers.length} actifs (${favorisSet.size} favoris) | Actions: ${activeActions.length} actives, ${overdueActions.length} échues | Risques ouverts: ${openRisks.length} (${criticalRisks.length} critiques) | Décisions en attente: ${pendingDecisions.length} | Comités à venir: ${upcomingComites.length}
Jalons: ${jalons.length} total, ${jalonsAtteints.length} atteints, ${jalonsEnRetard.length} en retard | Adhérences: ${adherences.length} total, ${blockedAdherences.length} bloquées | Q&A Consultation: ${consultationQuestions.length} total, ${openQuestions.length} ouvertes (${criticalOpenQuestions.length} critiques)

### Chantiers
${activeChantiers
  .map((c) => `- [${c.statut}] ${c.code} ${c.nom} | ${c.domaine} | ${c.priorite} | Budget: ${c.budgetTotalMAD || c.budget} MAD | Av: ${c.avancement}% | ${fmtDate(c.date_debut)}→${fmtDate(c.date_fin)} | Dir: ${c.directeur}${favorisSet.has(c.id) ? " | ★" : ""}`)
  .join("\n")}

### Actions échues (${overdueActions.length})
${overdueActions.length > 0
  ? overdueActions.slice(0, 15)
      .map((a) => `- ${a.intitule} | Éch: ${fmtDate(a.date_echeance)} | Resp: ${a.responsable} | ${a.chantier?.code || "—"}`)
      .join("\n")
  : "Aucune."}

### Actions actives (${activeActions.length})
${activeActions.slice(0, 20)
  .map((a) => `- [${a.statut}] ${a.intitule} | Resp: ${a.responsable} | ${a.chantier?.code || "—"} | Éch: ${fmtDate(a.date_echeance)}`)
  .join("\n")}
${activeActions.length > 20 ? `... et ${activeActions.length - 20} autres` : ""}

### Risques ouverts (${openRisks.length})
${openRisks.slice(0, 15)
  .map((r) => `- [${r.statut}] ${r.intitule} | Score: ${r.impact && r.probabilite ? scoreCriticite(r.impact, r.probabilite) : "—"}/25 | Resp: ${r.responsable} | ${r.chantier?.code || "—"}`)
  .join("\n")}
${openRisks.length > 15 ? `... et ${openRisks.length - 15} autres` : ""}

### Décisions en attente (${pendingDecisions.length})
${pendingDecisions.slice(0, 10)
  .map((d) => `- ${d.intitule} | Resp: ${d.responsable} | ${d.chantier?.code || "—"}`)
  .join("\n")}

### Jalons en retard (${jalonsEnRetard.length})
${jalonsEnRetard.length > 0
  ? jalonsEnRetard.slice(0, 10)
      .map((j) => `- ${j.nom} | Phase: ${j.phase} | Cible: ${fmtDate(j.date_cible)} | ${j.chantier?.code || "—"}`)
      .join("\n")
  : "Aucun."}

### Adhérences bloquées (${blockedAdherences.length})
${blockedAdherences.length > 0
  ? blockedAdherences.slice(0, 10)
      .map((a) => `- ${a.chantierSource?.code}→${a.chantierDependant?.code || a.chantierDependantLabel || "ALL"} | ${a.type} | ${a.criticite}`)
      .join("\n")
  : "Aucune."}

### Questions Consultation ouvertes (${openQuestions.length})
${openQuestions.length > 0
  ? openQuestions.slice(0, 10)
      .map((q) => `- [${q.priorite}] ${q.question.slice(0, 80)} | ${q.categorie} | ${q.chantier?.code || "—"}`)
      .join("\n")
  : "Aucune."}
${openQuestions.length > 10 ? `... et ${openQuestions.length - 10} autres` : ""}

### Comités à venir (${upcomingComites.length})
${upcomingComites.slice(0, 5)
  .map((c) => `- ${c.instance} #${c.numero} | ${fmtDate(c.date)} | ${c.heure_casablanca || "—"}`)
  .join("\n")}

Seuil relance: ${settings?.seuil_relance_jours ?? 3}j | Seuil Q&A critique: ${settings?.seuil_qa_critique_heures ?? 48}h
`;

    // Build conversation messages with history
    const conversationMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content: `Tu es un assistant PMO expert en transformation bancaire. Tu analyses les données de pilotage et fournis des recommandations actionnables. Réponds toujours en français. Utilise le contexte ci-dessous pour répondre aux questions.\n\n${contextePMO}`,
      },
    ];

    // Keep last 6 messages to stay within Groq TPM limits
    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        conversationMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current message
    conversationMessages.push({ role: "user", content: message });

    const groq = getGroqClient();
    const chatCompletion = await groq.chat.completions.create({
      messages: conversationMessages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 1024,
    });

    const reply = chatCompletion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Erreur API Chat:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erreur interne du serveur.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
