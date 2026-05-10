import Link from "next/link";
import { Button } from "@/components/ui/button";

// Renders one tool slot on the landing page. Two states:
//   active     - links to the tool's entry route, "Open" CTA enabled
//   coming_soon - placeholder card the user can swap for a real tool by
//                 changing status to "active" and providing href + content
export interface ToolCardProps {
  status: "active" | "coming_soon";
  title: string;
  description: string;
  // Required when status is "active". Ignored when "coming_soon".
  href?: string;
  // Optional bullet highlights surfaced under the description.
  highlights?: string[];
  // Optional one-line tagline above the title.
  tagline?: string;
}

export function ToolCard({
  status,
  title,
  description,
  href,
  highlights,
  tagline,
}: ToolCardProps) {
  const isActive = status === "active";

  return (
    <article
      className={`rounded-lg border p-5 flex flex-col gap-4 transition ${
        isActive
          ? "hover:border-foreground/40 hover:bg-muted/20"
          : "bg-muted/30 border-dashed"
      }`}
    >
      <div className="space-y-2 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {tagline ? (
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {tagline}
              </p>
            ) : null}
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          </div>
          {!isActive ? (
            <span className="shrink-0 inline-flex items-center rounded-full bg-background border px-2 py-0.5 text-xs text-muted-foreground">
              Coming soon
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        {highlights && highlights.length > 0 ? (
          <ul className="text-xs text-muted-foreground space-y-1 pt-1">
            {highlights.map((h, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground/60">·</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div>
        {isActive && href ? (
          <Link href={href}>
            <Button size="sm">Open</Button>
          </Link>
        ) : (
          <Button size="sm" variant="outline" disabled>
            Coming soon
          </Button>
        )}
      </div>
    </article>
  );
}
