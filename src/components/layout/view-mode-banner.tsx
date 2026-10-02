import { Button } from "@/components/ui/button";
import { toggleViewModeAction } from "@/lib/auth/actions";

/** Bandeau discret affiché quand un admin consulte Merlin en vue utilisateur. */
export function ViewModeBanner() {
  return (
    <div
      data-testid="view-mode-banner"
      className="bg-accent text-accent-foreground border-border border-b"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-sm sm:px-6 lg:px-8">
        <p>Vous consultez Merlin comme un utilisateur</p>
        <form action={toggleViewModeAction}>
          <Button type="submit" variant="link" size="sm" className="h-auto p-0">
            Revenir en vue admin
          </Button>
        </form>
      </div>
    </div>
  );
}
