import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Grade } from "@/lib/diagnostics/types";
import { PieceCard } from "./piece-card";

interface DiagnosticRow {
  id: string;
  overall_label: string | null;
  script_version: string | null;
  created_at: string;
}

interface PieceRow {
  id: string;
  title: string;
  current_phase: string;
  word_count: number;
  estimated_seconds: number;
  updated_at: string;
  diagnostics: DiagnosticRow[] | null;
}

const PHASE_LABEL: Record<string, string> = {
  phase_0: "Confirming context",
  decision_screen: "Choosing direction",
  phase_1: "Diagnosed",
  phase_2: "Refining",
  phase_3: "Refined",
  phase_4: "Deriving formats",
  skeleton_mode: "Rebuilding from seed",
  back_to_phase_0: "Restarting",
  completed: "Completed",
};

const OVERALL_TO_GRADE: Record<string, Grade> = {
  Strong: "A",
  Mixed: "C",
  "Needs Work": "F",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(1, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function pickLatestDiagnostic(rows: DiagnosticRow[] | null): DiagnosticRow | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

function resumeTarget(piece: PieceRow): {
  href: string;
  label: string;
} {
  const latest = pickLatestDiagnostic(piece.diagnostics);
  switch (piece.current_phase) {
    case "phase_0":
      return { href: `/phase0/${piece.id}`, label: "Resume Phase 0" };
    case "decision_screen":
      return { href: `/decision/${piece.id}`, label: "Resume" };
    case "phase_1":
    case "phase_2":
    case "phase_3":
    case "skeleton_mode":
    case "back_to_phase_0":
      return latest
        ? {
            href: `/diagnostic/${piece.id}/summary`,
            label: "Open",
          }
        : { href: `/diagnostic/${piece.id}`, label: "Resume" };
    case "phase_4":
    case "completed":
      return { href: `/convert/${piece.id}`, label: "Open derivation" };
    default:
      return { href: `/diagnostic/${piece.id}/summary`, label: "Open" };
  }
}

export default async function PiecesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pieces");

  const { data: rows } = await supabase
    .from("pieces")
    .select(
      "id, title, current_phase, word_count, estimated_seconds, updated_at, diagnostics(id, overall_label, script_version, created_at)",
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const pieces = (rows ?? []) as PieceRow[];

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full space-y-6">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My pieces</h1>
            <p className="text-sm text-muted-foreground">
              Every script you{"'"}ve started, sorted by most recent activity.
            </p>
          </div>
          <Link href="/">
            <Button>Start a new piece</Button>
          </Link>
        </header>

        {pieces.length === 0 ? (
          <div className="rounded-lg border bg-muted/20 p-8 text-center space-y-2">
            <p className="font-medium">Nothing here yet.</p>
            <p className="text-sm text-muted-foreground">
              Paste a script on the homepage to get started.
            </p>
            <div>
              <Link href="/">
                <Button size="sm" className="mt-2">
                  Go to the homepage
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {pieces.map((p) => {
              const latest = pickLatestDiagnostic(p.diagnostics);
              const overall = latest?.overall_label ?? null;
              const grade = overall ? OVERALL_TO_GRADE[overall] ?? null : null;
              const target = resumeTarget(p);
              return (
                <PieceCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  wordCount={p.word_count}
                  estimatedSeconds={p.estimated_seconds}
                  updatedRelative={relativeTime(p.updated_at)}
                  phaseLabel={PHASE_LABEL[p.current_phase] ?? p.current_phase}
                  resumeHref={target.href}
                  resumeLabel={target.label}
                  overallLabel={overall}
                  representativeGrade={grade}
                  scriptVersion={
                    latest?.script_version === "refined" ||
                    latest?.script_version === "source"
                      ? latest.script_version
                      : null
                  }
                />
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
