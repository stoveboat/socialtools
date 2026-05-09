import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/header";
import { createClient } from "@/lib/supabase/server";

interface CardProps {
  href: string;
  title: string;
  description: string;
}

function DecisionCard({ href, title, description }: CardProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg border p-6 transition hover:border-foreground/40 hover:bg-muted/40"
    >
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/decision/${id}`);

  const { data: piece } = await supabase
    .from("pieces")
    .select("id")
    .eq("id", id)
    .single();
  if (!piece) notFound();

  return (
    <div className="min-h-svh flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16 max-w-3xl mx-auto w-full space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">
            Your script is ready. What would you like to do?
          </h1>
        </header>

        <div className="space-y-3">
          <DecisionCard
            href={`/diagnostic/${id}`}
            title="Run the diagnostic"
            description="Get a grade across 11 dimensions with specific evidence and repair recommendations. Takes about 30 seconds."
          />
          <DecisionCard
            href={`/convert/${id}/lite`}
            title="Convert into four formats"
            description="Derive carousel, caption reel, and voiceover-with-b-roll versions. Takes 5–10 minutes."
          />
          <DecisionCard
            href={`/diagnostic/${id}?then=convert`}
            title="Both — diagnose first, then convert"
            description="Get the grade, fix anything weak, then derive the formats from a refined version."
          />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Not sure? Start with the diagnostic — you can decide what to do next
          based on what it finds.
        </p>
      </main>
    </div>
  );
}
