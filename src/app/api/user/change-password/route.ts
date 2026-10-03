import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/server/server.session";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { oldPassword, newPassword } = await req.json();
  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "oldPassword and newPassword required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  try {
    const db = getFirestoreDB();

    // Fetch stored hash
    const authDoc = await db
      .collection("users")
      .doc(user.username)
      .collection("protected")
      .doc("auth")
      .get();

    if (!authDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const storedHash = authDoc.data()!.password as string;
    const valid = await bcrypt.compare(oldPassword, storedHash);
    if (!valid) {
      return NextResponse.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 403 });
    }

    // Hash and save new password
    const hashed = await bcrypt.hash(newPassword, 12);
    await db
      .collection("users")
      .doc(user.username)
      .collection("protected")
      .doc("auth")
      .set({ password: hashed }, { merge: true });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error changing password:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
