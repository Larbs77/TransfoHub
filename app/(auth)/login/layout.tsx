import { AuthBrandShell } from "@/components/auth-brand-shell";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthBrandShell>{children}</AuthBrandShell>;
}
