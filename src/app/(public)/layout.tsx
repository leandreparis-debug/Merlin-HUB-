import { PublicShell } from "@/components/layout/public-shell";

/** Layout des pages publiques (connexion) : en-tête sans menu utilisateur. */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicShell>{children}</PublicShell>;
}
