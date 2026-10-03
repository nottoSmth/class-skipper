// API route for admin calendar range (start/end dates) CRUD
// Server-side only — admin role required

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
    const snap = await db.collection("calendar").doc("properties").get();
    if (!snap.exists) {
      return NextResponse.json({ start: "", end: "" }, { status: 200 });
    }
    const data = snap.data()!;
    return NextResponse.json(
      {
        start: data["start-calendar"] || "",
        end: data["end-calendar"] || "",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error fetching calendar:", err);
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
    const { start, end } = body;

    if (typeof start !== "string" || typeof end !== "string") {
      return NextResponse.json({ error: "start and end are required strings" }, { status: 400 });
    }

    const db = getFirestoreDB();
    await db.collection("calendar").doc("properties").set(
      {
        "start-calendar": start,
        "end-calendar": end,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error updating calendar:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
