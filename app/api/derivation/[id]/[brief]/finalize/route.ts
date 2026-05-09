import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; brief: string }> },
) {
  const { id: pieceId, brief: briefId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: piece } = await supabase
    .from("pieces")
    .select("user_id")
    .eq("id", pieceId)
    .single();
  if (!piece || piece.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("derivation_briefs")
    .update({ status: "final", finalized_at: new Date().toISOString() })
    .eq("id", briefId)
    .eq("piece_id", pieceId);
  if (error) {
    return NextResponse.json(
      { error: "save_failed", detail: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
