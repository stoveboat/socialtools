import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnosticOwner } from "@/lib/db/repair";
import {
  PASS_BLURB,
  PASS_DIMENSIONS,
  PASS_LABEL,
} from "@/lib/diagnostics/passes";
import { SurfaceFlow } from "./surface-flow";

export default async function SurfacePassPage({
  params,
}: {
  params: Promise<{ diagnosticId: string }>;
}) {
  const { diagnosticId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/repair/${diagnosticId}/surface`);

  const owner = await loadDiagnosticOwner(diagnosticId, user.id);
  if (!owner) notFound();

  const { data: ctx } = await supabase
    .from("phase_0_contexts")
    .select("audience_selection, custom_audience")
    .eq("piece_id", owner.piece_id)
    .single();
  const defaultAudience =
    ctx?.custom_audience || ctx?.audience_selection || "";

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full space-y-6">
        <Link
          href={`/diagnostic/${owner.piece_id}/summary`}
          className="text-sm underline text-muted-foreground inline-block"
        >
          ← Back to summary
        </Link>

        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pass 3 of 3
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {PASS_LABEL.surface}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {PASS_BLURB.surface}
          </p>
          <p className="text-xs text-muted-foreground">
            Addresses:{" "}
            {PASS_DIMENSIONS.surface
              .map((d) =>
                d
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase()),
              )
              .join(", ")}
          </p>
        </header>

        <SurfaceFlow
          diagnosticId={diagnosticId}
          pieceId={owner.piece_id}
          defaultAudience={defaultAudience}
        />
      </main>
    </div>
  );
}
