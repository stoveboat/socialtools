import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  briefFilename,
  briefToText,
} from "@/lib/diagnostics/brief-text";
import {
  FORMAT_LABEL,
  REGISTERS_BY_FORMAT,
  type BriefContent,
  type CaptionReelBrief,
  type CarouselBrief,
  type DerivationFormat,
  type FriendVOBrief,
  type InterviewCutBrief,
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
            {fmt === "caption_reel"
              ? FORMAT_LABEL[fmt]
              : `${FORMAT_LABEL[fmt]} — ${brief.register}`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Production brief
          </h1>
          {fmt !== "caption_reel"
            ? (() => {
                const opt = REGISTERS_BY_FORMAT[fmt].find(
                  (o) => o.name === brief.register,
                );
                return opt ? (
                  <p className="text-sm text-muted-foreground">
                    {opt.oneliner}
                  </p>
                ) : null;
              })()
            : null}
          {brief.status === "final" ? (
            <p className="text-xs inline-block mt-2 rounded-md bg-emerald-50 text-emerald-900 px-2 py-1">
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
          <CaptionReelView
            brief={content as CaptionReelBrief}
            pieceId={id}
          />
        ) : (
          <VoiceoverView brief={content as VoiceoverBrief} pieceId={id} />
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

function CaptionReelView({
  brief,
  pieceId,
}: {
  brief: CaptionReelBrief;
  pieceId: string;
}) {
  // Detect legacy shape: old briefs were stored as { text_cards, ... }
  // before the wall-of-text redefinition. Accept the JSONB but show a
  // regenerate prompt rather than rendering broken UI.
  const legacy =
    "text_cards" in (brief as unknown as Record<string, unknown>);
  if (legacy) {
    return (
      <div className="rounded-lg border bg-amber-50 border-amber-300 p-5 space-y-3">
        <p className="text-sm">
          This caption-reel brief was generated under an earlier definition
          of the format (a sequence of timed text cards). The format has
          since been redefined as a 7-second looping wall of text.
        </p>
        <p className="text-sm">
          Regenerate the brief from the configure screen to get the new
          wall format.
        </p>
        <Link href={`/convert/${pieceId}`}>
          <Button size="sm">Back to format selection</Button>
        </Link>
      </div>
    );
  }

  if (!brief.claimable_observation_found) {
    return (
      <div className="rounded-lg border bg-amber-50 border-amber-300 p-5 space-y-3">
        <p className="text-sm font-medium text-amber-950">
          This script doesn{"'"}t have a claimable observation strong enough
          to anchor a caption-reel wall.
        </p>
        {brief.claimable_observation_explanation ? (
          <p className="text-sm text-amber-900/90 leading-relaxed">
            {brief.claimable_observation_explanation}
          </p>
        ) : null}
        <p className="text-sm text-amber-900/90">
          Try the carousel or voiceover format, or refine the talking head
          to surface one specific claim before regenerating.
        </p>
        <Link href={`/convert/${pieceId}`}>
          <Button size="sm" variant="outline">
            Back to format selection
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{brief.word_count} words</span>
        <span>·</span>
        <span>~{brief.estimated_read_time_seconds.toFixed(1)}s to read</span>
        <span>·</span>
        <span>looping at 7s</span>
      </div>

      <div className="rounded-lg border bg-background p-8">
        <pre className="whitespace-pre-wrap font-sans text-xl leading-relaxed text-center">
          {brief.wall_text}
        </pre>
      </div>

      <div className="rounded-lg border bg-muted/20 p-5 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Why this works
        </p>
        <dl className="space-y-3 text-sm">
          {brief.claimable_observation_explanation ? (
            <div>
              <dt className="font-medium">Claimable observation</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.claimable_observation_explanation}
              </dd>
            </div>
          ) : null}
          {brief.first_line_function ? (
            <div>
              <dt className="font-medium">First line function</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.first_line_function}
              </dd>
            </div>
          ) : null}
          {brief.rereading_layers ? (
            <div>
              <dt className="font-medium">Rereading layer</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.rereading_layers}
              </dd>
            </div>
          ) : null}
          {brief.share_trigger ? (
            <div>
              <dt className="font-medium">Share trigger</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.share_trigger}
              </dd>
            </div>
          ) : null}
          {brief.comment_trigger ? (
            <div>
              <dt className="font-medium">Comment trigger</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.comment_trigger}
              </dd>
            </div>
          ) : null}
          {brief.screenshot_line ? (
            <div>
              <dt className="font-medium">Screenshot line</dt>
              <dd className="text-muted-foreground leading-relaxed italic">
                &ldquo;{brief.screenshot_line}&rdquo;
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {brief.production_notes ? (
        <p className="text-sm text-muted-foreground border-t pt-4">
          <span className="font-medium">Production notes: </span>
          {brief.production_notes}
        </p>
      ) : null}
    </div>
  );
}

function VoiceoverView({
  brief,
  pieceId,
}: {
  brief: VoiceoverBrief;
  pieceId: string;
}) {
  // Legacy: pre-rewrite voiceover briefs lacked a `variant` discriminator.
  // Detect by absence and surface a regenerate banner rather than crashing.
  const variant = (brief as { variant?: string }).variant;
  if (variant !== "interview_cut" && variant !== "friend_vo") {
    return (
      <div className="rounded-lg border bg-amber-50 border-amber-300 p-5 space-y-3">
        <p className="text-sm">
          This voiceover brief was generated under the earlier definition of
          the format (a single shape that conflated the Interview Cut and
          Re-Recorded Friend VO variants). Voiceover-with-b-roll has since
          been split into two distinct artifacts.
        </p>
        <p className="text-sm">
          Regenerate the brief from the configure screen — pick whichever
          variant fits the script.
        </p>
        <Link href={`/convert/${pieceId}`}>
          <Button size="sm">Back to format selection</Button>
        </Link>
      </div>
    );
  }

  if (brief.variant === "interview_cut") {
    return <InterviewCutView brief={brief} pieceId={pieceId} />;
  }
  return <FriendVOView brief={brief} pieceId={pieceId} />;
}

function InterviewCutView({
  brief,
  pieceId,
}: {
  brief: InterviewCutBrief;
  pieceId: string;
}) {
  return (
    <div className="space-y-5">
      {brief.format_fit_assessment ? (
        <div className="rounded-md border bg-muted/30 p-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Format fit
          </p>
          <p className="text-sm leading-relaxed">{brief.format_fit_assessment}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{brief.selected_sentences.length} sentences in the cut</span>
        <span>·</span>
        <span>
          ~{brief.estimated_total_duration_seconds.toFixed(1)}s total
        </span>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Cutting plan
        </p>
        <ol className="space-y-3 text-sm">
          {brief.selected_sentences.map((s) => (
            <li key={s.sentence_number} className="space-y-1">
              <p className="leading-relaxed">
                <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded mr-2">
                  {s.sentence_number}
                </span>
                {s.talking_head_sentence}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.edit_notes}
                {s.estimated_duration_seconds
                  ? ` · ~${s.estimated_duration_seconds.toFixed(1)}s`
                  : ""}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {brief.text_overlay_phrases.length > 0 ? (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Text overlay phrases ({brief.text_overlay_phrases.length})
          </p>
          <ul className="space-y-1 text-sm">
            {brief.text_overlay_phrases.map((p, i) => (
              <li key={i} className="font-medium">
                &ldquo;{p}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {brief.talking_head_cutbacks.length > 0 ? (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Cutbacks to talking-head footage
          </p>
          <ul className="space-y-1 text-sm">
            {brief.talking_head_cutbacks.map((c, i) => (
              <li key={i}>
                <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded mr-2">
                  {c.timestamp}
                </span>
                {c.purpose}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          B-roll timeline
        </p>
        <ul className="space-y-2 text-sm">
          {brief.broll_timeline.map((b, i) => (
            <li key={i}>
              <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded">
                {b.timestamp_start}–{b.timestamp_end}
              </span>{" "}
              {b.broll_description}
              <span className="text-muted-foreground"> · {b.purpose}</span>
            </li>
          ))}
        </ul>
      </div>

      {brief.sentences_cut.length > 0 ? (
        <details className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Sentences cut from the talking head ({brief.sentences_cut.length})
          </summary>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            {brief.sentences_cut.map((s, i) => (
              <li key={i} className="line-through">
                {s}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {brief.production_notes ? (
        <p className="text-sm text-muted-foreground border-t pt-4">
          <span className="font-medium">Production notes: </span>
          {brief.production_notes}
        </p>
      ) : null}
      <span className="hidden">{pieceId}</span>
    </div>
  );
}

function FriendVOView({
  brief,
  pieceId,
}: {
  brief: FriendVOBrief;
  pieceId: string;
}) {
  // Honest "no Friend material" fallback — the model said the talking head
  // doesn't anchor a Friend VO. Surface that to the user instead of
  // pretending the script works.
  const hasMaterial = brief.audio_script.trim().length > 0;
  if (!hasMaterial) {
    return (
      <div className="rounded-lg border bg-amber-50 border-amber-300 p-5 space-y-3">
        <p className="text-sm font-medium text-amber-950">
          The talking head doesn{"'"}t contain authentic Friend material.
        </p>
        {brief.friend_material_assessment ? (
          <p className="text-sm text-amber-900/90 leading-relaxed">
            {brief.friend_material_assessment}
          </p>
        ) : null}
        <p className="text-sm text-amber-900/90">
          Try the Interview Cut variant, or refine the talking head to
          surface a specific vulnerability moment before regenerating.
        </p>
        <Link href={`/convert/${pieceId}`}>
          <Button size="sm" variant="outline">
            Back to format selection
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {brief.friend_material_assessment ? (
        <div className="rounded-md border bg-muted/30 p-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Friend material assessment
          </p>
          <p className="text-sm leading-relaxed">
            {brief.friend_material_assessment}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{brief.word_count} words</span>
        <span>·</span>
        <span>
          ~{brief.estimated_duration_seconds.toFixed(0)}s at 130-150 wpm
        </span>
      </div>

      <div className="rounded-lg border bg-background p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
          Audio script (recorded fresh, intimate register)
        </p>
        <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed">
          {brief.audio_script}
        </pre>
      </div>

      <div className="rounded-lg border bg-muted/20 p-5 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Structural arc
        </p>
        <dl className="space-y-3 text-sm">
          {brief.structural_arc.drop_in_opener ? (
            <div>
              <dt className="font-medium">Drop-in opener</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.structural_arc.drop_in_opener}
              </dd>
            </div>
          ) : null}
          {brief.structural_arc.escalation ? (
            <div>
              <dt className="font-medium">Escalation</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.structural_arc.escalation}
              </dd>
            </div>
          ) : null}
          {brief.structural_arc.vulnerability_beat ? (
            <div>
              <dt className="font-medium">Vulnerability beat</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.structural_arc.vulnerability_beat}
              </dd>
            </div>
          ) : null}
          {brief.structural_arc.reflection ? (
            <div>
              <dt className="font-medium">Reflection</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.structural_arc.reflection}
              </dd>
            </div>
          ) : null}
          {brief.structural_arc.implicit_invitation ? (
            <div>
              <dt className="font-medium">Implicit invitation (close)</dt>
              <dd className="text-muted-foreground leading-relaxed">
                {brief.structural_arc.implicit_invitation}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {brief.broll_timeline.length > 0 ? (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            B-roll timeline (atmospheric / metaphorical)
          </p>
          <ul className="space-y-2 text-sm">
            {brief.broll_timeline.map((b, i) => (
              <li key={i}>
                <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded">
                  {b.timestamp_start}–{b.timestamp_end}
                </span>{" "}
                {b.broll_description}
                <span className="text-muted-foreground"> · {b.purpose}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {brief.audio_treatment_notes ? (
        <p className="text-sm">
          <span className="font-medium">Audio treatment: </span>
          {brief.audio_treatment_notes}
        </p>
      ) : null}
      {brief.comment_trigger ? (
        <p className="text-sm text-muted-foreground border-t pt-4">
          <span className="font-medium">Comment trigger: </span>
          {brief.comment_trigger}
        </p>
      ) : null}
    </div>
  );
}
