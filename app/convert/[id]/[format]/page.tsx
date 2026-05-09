import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";
import {
  briefFilename,
  briefToText,
} from "@/lib/diagnostics/brief-text";
import {
  FORMAT_LABEL,
  type BriefContent,
  type CaptionReelBrief,
  type CarouselBrief,
  type DerivationFormat,
  type VoiceoverBrief,
} from "@/lib/diagnostics/types";
import { BriefActions } from "./brief-actions";

const VALID_FORMATS = new Set<DerivationFormat>([
  "carousel",
  "caption_reel",
  "voiceover_broll",
]);

export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string; format: string }>;
}) {
  const { id, format } = await params;
  if (!VALID_FORMATS.has(format as DerivationFormat)) notFound();
  const fmt = format as DerivationFormat;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/convert/${id}/${format}`);

  const { data: piece } = await supabase
    .from("pieces")
    .select("id")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  const { data: brief } = await supabase
    .from("derivation_briefs")
    .select("id, format, register, brief_content, status, created_at, finalized_at")
    .eq("piece_id", id)
    .eq("format", fmt)
    .neq("status", "discarded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!brief) {
    redirect(`/convert/${id}`);
  }

  const content = brief.brief_content as BriefContent;
  const text = briefToText(fmt, brief.register, content);
  const filename = briefFilename(fmt, brief.register);

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-6">
        <Link
          href={`/convert/${id}`}
          className="text-sm underline text-muted-foreground"
        >
          ← Back to format selection
        </Link>

        <header className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {FORMAT_LABEL[fmt]} — {brief.register} register
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Production brief
          </h1>
          {brief.status === "final" ? (
            <p className="text-xs inline-block rounded-md bg-emerald-50 text-emerald-900 px-2 py-1">
              Marked final
            </p>
          ) : null}
        </header>

        <BriefActions
          pieceId={id}
          briefId={brief.id}
          format={fmt}
          currentRegister={brief.register}
          textForCopy={text}
          filename={filename}
        />

        {fmt === "carousel" ? (
          <CarouselView brief={content as CarouselBrief} />
        ) : fmt === "caption_reel" ? (
          <CaptionReelView brief={content as CaptionReelBrief} />
        ) : (
          <VoiceoverView brief={content as VoiceoverBrief} />
        )}
      </main>
    </div>
  );
}

function CarouselView({ brief }: { brief: CarouselBrief }) {
  return (
    <div className="space-y-5">
      <Slide title="Cover" body={brief.cover_slide.headline} accent />
      {brief.interior_slides.map((s) => (
        <Slide
          key={s.slide_number}
          title={`Slide ${s.slide_number} — ${s.headline}`}
          body={s.body}
        />
      ))}
      <Slide title="Final slide (CTA)" body={brief.final_slide.cta} accent />
      {brief.design_notes ? (
        <p className="text-sm text-muted-foreground border-t pt-4">
          <span className="font-medium">Design notes: </span>
          {brief.design_notes}
        </p>
      ) : null}
    </div>
  );
}

function Slide({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${accent ? "bg-muted/40" : ""}`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <p className="leading-relaxed whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function CaptionReelView({ brief }: { brief: CaptionReelBrief }) {
  return (
    <div className="space-y-5">
      {brief.music_recommendation ? (
        <p className="text-sm rounded-md bg-muted/40 px-3 py-2">
          <span className="font-medium">Music: </span>
          {brief.music_recommendation}
        </p>
      ) : null}
      {brief.text_cards.map((c) => (
        <div key={c.card_number} className="rounded-lg border p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Card {c.card_number} — {c.duration_seconds}s
          </p>
          <p className="text-lg font-medium leading-snug">{c.text}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">B-roll: </span>
            {c.broll_suggestion}
          </p>
        </div>
      ))}
      {brief.production_notes ? (
        <p className="text-sm text-muted-foreground border-t pt-4">
          <span className="font-medium">Production notes: </span>
          {brief.production_notes}
        </p>
      ) : null}
    </div>
  );
}

function VoiceoverView({ brief }: { brief: VoiceoverBrief }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Audio script
        </p>
        <p className="leading-relaxed whitespace-pre-wrap">
          {brief.audio_script}
        </p>
      </div>
      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          B-roll timeline
        </p>
        <ul className="space-y-2">
          {brief.broll_timeline.map((b, i) => (
            <li key={i} className="text-sm">
              <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded">
                {b.timestamp_start}–{b.timestamp_end}
              </span>{" "}
              {b.broll_description}
              <span className="text-muted-foreground"> · {b.purpose}</span>
            </li>
          ))}
        </ul>
      </div>
      {brief.pacing_notes ? (
        <p className="text-sm">
          <span className="font-medium">Pacing: </span>
          {brief.pacing_notes}
        </p>
      ) : null}
      {brief.audio_treatment_notes ? (
        <p className="text-sm">
          <span className="font-medium">Audio treatment: </span>
          {brief.audio_treatment_notes}
        </p>
      ) : null}
    </div>
  );
}
