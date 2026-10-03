import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/server.session";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const db = getFirestoreDB();
    const usersSnap = await db.collection("users").get();
    const users = usersSnap.docs.map(doc => ({
      username: doc.id,
      ...doc.data()
    }));
    return NextResponse.json({ users }, { status: 200 });
  } catch (err) {
    console.error("Error fetching users:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
  const { username, password, role, room } = await req.json();
  if (!username || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const db = getFirestoreDB();
    const userDocRef = db.collection("users").doc(username);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    await userDocRef.set({ role: role || "user", room: room || "" });
    const hashed = await bcrypt.hash(password, 12);
    await userDocRef.collection("protected").doc("auth").set({ password: hashed });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error creating user:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
  const { username, role, room } = await req.json();
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  try {
    const db = getFirestoreDB();
    await db.collection("users").doc(username).set({ role, room }, { merge: true });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error updating user:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  try {
    const db = getFirestoreDB();
    // Delete protected/auth
    await db.collection("users").doc(username).collection("protected").doc("auth").delete();
    // Delete user
    await db.collection("users").doc(username).delete();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error deleting user:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
