import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/server.session";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
  const { roomId } = await req.json();
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  try {
    const db = getFirestoreDB();
    await db.collection("rooms").doc(roomId).set({});
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error creating room:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  try {
    const db = getFirestoreDB();
    await db.collection("rooms").doc(roomId).delete();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error deleting room:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
