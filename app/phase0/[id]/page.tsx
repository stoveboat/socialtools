import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import { confirmPhase0 } from "./actions";
import { Phase0Form } from "./phase0-form";

export default async function Phase0Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/phase0/${id}`);

  const { data: piece } = await supabase
    .from("pieces")
    .select("id, source_script, word_count, estimated_seconds")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  const { data: ctx } = await supabase
    .from("phase_0_contexts")
    .select(
      "topic_summary, audience_candidates, channel_candidates, is_low_confidence",
    )
    .eq("piece_id", id)
    .single();
  if (!ctx) notFound();

  const action = confirmPhase0.bind(null, id);

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-1">Confirm the read</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The grader uses these answers to anchor every dimension. Confirm or
          override before continuing.
        </p>

        {error ? (
          <p
            role="alert"
            className="mb-4 text-sm rounded-md bg-red-50 text-red-900 px-3 py-2"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <header className="text-xs uppercase tracking-wide text-muted-foreground">
              Source Material — {piece.word_count} words • ~
              {piece.estimated_seconds} seconds
            </header>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/40 rounded-md p-4 max-h-[70vh] overflow-y-auto">
              {piece.source_script}
            </pre>
          </section>

          <section>
            <Phase0Form
              topic_summary={ctx.topic_summary ?? ""}
              audience_candidates={ctx.audience_candidates ?? []}
              channel_candidates={ctx.channel_candidates ?? []}
              is_low_confidence={ctx.is_low_confidence === true}
              action={action}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
