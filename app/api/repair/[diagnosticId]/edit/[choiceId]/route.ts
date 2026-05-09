import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadDiagnosticOwner } from "@/lib/db/repair";

const VALID_STATUSES = new Set(["accepted", "rejected", "edited"]);

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string; choiceId: string }>;
  },
) {
  const { diagnosticId, choiceId } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "");
  const userEdit = body.user_edited_replacement;

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  if (status === "edited" && typeof userEdit !== "string") {
    return NextResponse.json(
      { error: "edited_requires_replacement_text" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const owner = await loadDiagnosticOwner(diagnosticId, user.id);
  if (!owner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = {
    status,
    applied_at: new Date().toISOString(),
  };
  if (status === "edited") {
    update.user_edited_replacement = userEdit;
  } else if (status === "rejected") {
    update.user_edited_replacement = null;
  }

  const { error } = await supabase
    .from("repair_choices")
    .update(update)
    .eq("id", choiceId);
  if (error) {
    return NextResponse.json(
      { error: "save_failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
