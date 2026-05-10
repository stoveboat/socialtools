import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_SCOPES = new Set(["piece", "pass"]);

async function verifyOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pieceId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("pieces")
    .select("user_id")
    .eq("id", pieceId)
    .single();
  return data?.user_id === userId;
}

// POST: upsert an override marking a dimension as intentional.
// Body: { dimension_id, scope: "piece" | "pass", reason?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> },
) {
  const { pieceId } = await params;
  const body = await request.json().catch(() => ({}));
  const dimension_id = String(body.dimension_id ?? "").trim();
  const scope = String(body.scope ?? "piece");
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : undefined;

  if (!dimension_id) {
    return NextResponse.json(
      { error: "dimension_id_required" },
      { status: 400 },
    );
  }
  if (!VALID_SCOPES.has(scope)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!(await verifyOwnership(supabase, pieceId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Upsert: replace any existing override for this (piece, dimension) — the
  // unique constraint enforces one row per pair.
  await supabase
    .from("dimension_overrides")
    .delete()
    .eq("piece_id", pieceId)
    .eq("dimension_id", dimension_id);
  const { error } = await supabase.from("dimension_overrides").insert({
    piece_id: pieceId,
    dimension_id,
    scope,
    reason: reason || null,
  });
  if (error) {
    return NextResponse.json(
      { error: "save_failed", detail: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

// DELETE: remove an override.
// Query: ?dimension_id=<id>
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> },
) {
  const { pieceId } = await params;
  const url = new URL(request.url);
  const dimension_id = (url.searchParams.get("dimension_id") ?? "").trim();
  if (!dimension_id) {
    return NextResponse.json(
      { error: "dimension_id_required" },
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
  if (!(await verifyOwnership(supabase, pieceId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("dimension_overrides")
    .delete()
    .eq("piece_id", pieceId)
    .eq("dimension_id", dimension_id);
  if (error) {
    return NextResponse.json(
      { error: "delete_failed", detail: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
