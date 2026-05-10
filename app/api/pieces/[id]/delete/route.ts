import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // RLS enforces ownership on its own — the .delete with user_id check is
  // belt-and-braces and gives a clearer 403 vs RLS's silent zero-row return.
  const { data: piece } = await supabase
    .from("pieces")
    .select("user_id")
    .eq("id", id)
    .single();
  if (!piece) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (piece.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("pieces").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "delete_failed", detail: error.message },
      { status: 500 },
    );
  }
  // Cascade deletes handle phase_0_contexts, diagnostics, repair_plans, etc.
  return NextResponse.json({ ok: true });
}
