import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import type { DerivationFormat } from "@/lib/diagnostics/types";
import { FormatPanel } from "./format-panel";

const FORMAT_QUESTIONS: Record<DerivationFormat, string> = {
  carousel: "What does the carousel do that the talking head can't?",
  caption_reel: "What does the caption reel do that the talking head can't?",
  voiceover_broll: "Who is the voiceover speaking as?",
};

export default async function ConvertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/convert/${id}`);

  const { data: piece } = await supabase
    .from("pieces")
    .select("id")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  const { data: briefs } = await supabase
    .from("derivation_briefs")
    .select("format, register, status")
    .eq("piece_id", id)
    .neq("status", "discarded");

  const existingByFormat: Partial<Record<DerivationFormat, { register: string }>> =
    {};
  for (const b of briefs ?? []) {
    existingByFormat[b.format as DerivationFormat] = { register: b.register };
  }

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Ready to derive. Pick the angle for each format.
          </h1>
          <p className="text-sm text-muted-foreground">
            Each format becomes a separate production brief. The angle you
            pick changes what the brief is — a tactical reference vs. a
            confessional list, a wall-of-text loop vs. a sequential card
            reel — without changing the underlying idea. Regenerate any
            panel without affecting the others.
          </p>
        </header>

        <div className="space-y-4">
          <FormatPanel
            pieceId={id}
            format="carousel"
            question={FORMAT_QUESTIONS.carousel}
            existing={existingByFormat.carousel}
          />
          <FormatPanel
            pieceId={id}
            format="caption_reel"
            question={FORMAT_QUESTIONS.caption_reel}
            existing={existingByFormat.caption_reel}
          />
          <FormatPanel
            pieceId={id}
            format="voiceover_broll"
            question={FORMAT_QUESTIONS.voiceover_broll}
            existing={existingByFormat.voiceover_broll}
          />
        </div>
      </main>
    </div>
  );
}
