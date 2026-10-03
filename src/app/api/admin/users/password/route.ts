import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/server.session";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
  const { username, password } = await req.json();
  if (!username || !password) return NextResponse.json({ error: "username and password required" }, { status: 400 });

  try {
    const db = getFirestoreDB();
    const hashed = await bcrypt.hash(password, 12);
    await db.collection("users").doc(username).collection("protected").doc("auth").set({ password: hashed }, { merge: true });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error updating password:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
