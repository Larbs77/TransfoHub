const MENTION_RE =
  /@\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]/g;

export function mentionToken(ressourceId: string): string {
  return `@[${ressourceId}]`;
}

/** Replace `@Nom` occurrences with stable `@[ressourceId]` tokens. */
export function applyMentionTokens(
  body: string,
  mentions: { id: string; nom_complet: string }[]
): { body: string; ids: string[] } {
  let stored = body;
  const sorted = [...mentions].sort(
    (a, b) => b.nom_complet.length - a.nom_complet.length
  );
  const ids: string[] = [];
  for (const m of sorted) {
    const name = m.nom_complet.trim();
    if (!name) continue;
    const needle = `@${name}`;
    if (!stored.includes(needle)) continue;
    stored = stored.split(needle).join(mentionToken(m.id));
    ids.push(m.id);
  }
  return { body: stored, ids };
}

export type MentionSegment =
  | { type: "text"; text: string }
  | { type: "mention"; ressourceId: string };

export function parseMentionBody(body: string): MentionSegment[] {
  const out: MentionSegment[] = [];
  const re = new RegExp(MENTION_RE.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    if (match.index > last) {
      out.push({ type: "text", text: body.slice(last, match.index) });
    }
    out.push({ type: "mention", ressourceId: match[1] });
    last = match.index + match[0].length;
  }
  if (last < body.length) out.push({ type: "text", text: body.slice(last) });
  if (out.length === 0) out.push({ type: "text", text: body });
  return out;
}
