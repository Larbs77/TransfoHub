import { AuthBrandShell } from "@/components/auth-brand-shell";

export default function ChangePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthBrandShell>{children}</AuthBrandShell>;
}
