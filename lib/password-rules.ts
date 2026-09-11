const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

export const PASSWORD_RULES: {
  id: string;
  label: string;
  test: (p: string) => boolean;
}[] = [
  { id: "length", label: "Au moins 8 caractères", test: (p) => p.length >= 8 },
  { id: "lower", label: "Une lettre minuscule", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "Une lettre majuscule", test: (p) => /[A-Z]/.test(p) },
  { id: "digit", label: "Un chiffre", test: (p) => /\d/.test(p) },
  {
    id: "special",
    label: "Un caractère spécial (!@#$%…)",
    test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
  },
];

export function getPasswordRuleResults(password: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    ok: rule.test(password),
  }));
}

export function validatePasswordComplexity(password: string): string | null {
  const failed = getPasswordRuleResults(password)
    .filter((r) => !r.ok)
    .map((r) => r.label);
  if (failed.length === 0 && PASSWORD_REGEX.test(password)) return null;
  if (failed.length === 0) {
    return "Le mot de passe ne respecte pas les règles de complexité.";
  }
  return `Mot de passe incomplet : ${failed.join(", ")}.`;
}
