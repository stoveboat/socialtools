import { SiteHeader } from "@/components/header";
import { ToolCard } from "./tool-card";

// Landing page. The grid below is the toolkit menu — one active tool today
// (Script Studio) and four placeholder slots ready to be swapped for real
// tools as they get built.
//
// To add a new tool:
//   1. Build the tool's pages under app/<tool-slug>/ (the script tool lives
//      at app/script/, app/phase0/, app/diagnostic/, app/repair/, etc.).
//   2. Replace one of the placeholder ToolCards below with status="active",
//      a real href, title, description, and optional highlights.
//   3. If the tool has its own saved-state listing, link it from the
//      SiteHeader (currently "My pieces" → /pieces is the script tool's).
export default function LandingPage() {
  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 max-w-5xl mx-auto w-full space-y-12">
        <header className="space-y-3 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Hooklab</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A workshop of focused tools for short-form social-media creation.
            Pick a tool to start.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <ToolCard
            status="active"
            href="/script"
            tagline="Tool 01"
            title="Script Studio"
            description="Diagnose, refine, and convert short-form scripts. Eleven-dimension grader, integrated revision passes, and three production-ready format briefs."
            highlights={[
              "11-dimension diagnostic with payoff-aware rubrics",
              "Foundation, Engagement & Structure, and Surface revision passes",
              "Convert to Carousel, Caption Reel, or Voiceover with B-Roll",
            ]}
          />

          {/* Replace with a real tool when ready: set status="active",
              add href + title + description + highlights. */}
          <ToolCard
            status="coming_soon"
            tagline="Tool 02"
            title="(reserved)"
            description="Slot reserved for the next tool. Replace this card to wire up a new entry on the landing page."
          />

          <ToolCard
            status="coming_soon"
            tagline="Tool 03"
            title="(reserved)"
            description="Slot reserved for the next tool."
          />

          <ToolCard
            status="coming_soon"
            tagline="Tool 04"
            title="(reserved)"
            description="Slot reserved for the next tool."
          />

          <ToolCard
            status="coming_soon"
            tagline="Tool 05"
            title="(reserved)"
            description="Slot reserved for the next tool."
          />
        </section>

        <p className="text-xs text-muted-foreground text-center max-w-xl mx-auto">
          Each tool is a self-contained workflow. Sign in once and your work
          across tools lives under your account. New tools land here as they
          ship.
        </p>
      </main>
    </div>
  );
}
