// API route for admin day-off management
// Server-side only — admin role required
// Day-off data structure: calendar/properties/day-off/{YYYY-MM} → { bin: number }
// Each bit in `bin` represents whether that day (1-indexed) is a day-off.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/server.session";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getFirestoreDB();
    const snap = await db
      .collection("calendar")
      .doc("properties")
      .collection("day-off")
      .get();

    const dayoffs: Record<string, number> = {};
    snap.docs.forEach((d) => {
      dayoffs[d.id] = d.data()?.bin ?? 0;
    });

    return NextResponse.json({ dayoffs }, { status: 200 });
  } catch (err) {
    console.error("Error fetching day-offs:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { monthKey, bin } = body;

    if (!monthKey || typeof bin !== "number") {
      return NextResponse.json({ error: "monthKey and bin required" }, { status: 400 });
    }

    // Validate monthKey format: YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json({ error: "Invalid monthKey format" }, { status: 400 });
    }

    const db = getFirestoreDB();
    await db
      .collection("calendar")
      .doc("properties")
      .collection("day-off")
      .doc(monthKey)
      .set({ bin }, { merge: true });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error updating day-off:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
