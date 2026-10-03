// API route for admin timetable CRUD
// Server-side only — uses firebase-admin SDK (bypasses Firestore security rules)

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/server.session";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "privileged")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ error: "roomId required" }, { status: 400 });
  }

  // Privileged users can only view their own room
  if (user.role === "privileged" && user.room !== roomId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getFirestoreDB();
    const timetable: Record<string, Record<string, unknown>> = {};

    for (let dayId = 1; dayId <= 5; dayId++) {
      timetable[String(dayId)] = {};
      const classSnap = await db
        .collection("rooms")
        .doc(roomId)
        .collection("table")
        .doc(String(dayId))
        .collection("class")
        .get();

      classSnap.docs.forEach((d) => {
        timetable[String(dayId)][d.id] = d.data();
      });
    }

    return NextResponse.json({ timetable }, { status: 200 });
  } catch (err) {
    console.error("Error fetching timetable:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "privileged")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { roomId, dayId, periodId, data } = body;

    if (!roomId || !dayId || !periodId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Privileged users can only edit their own room
    if (user.role === "privileged" && user.room !== roomId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getFirestoreDB();

    // Ensure parent table doc exists
    await db
      .collection("rooms")
      .doc(roomId)
      .collection("table")
      .doc(String(dayId))
      .set({}, { merge: true });

    if (data === null) {
      // Delete the period
      await db
        .collection("rooms")
        .doc(roomId)
        .collection("table")
        .doc(String(dayId))
        .collection("class")
        .doc(String(periodId))
        .delete();
    } else {
      // Upsert the period
      await db
        .collection("rooms")
        .doc(roomId)
        .collection("table")
        .doc(String(dayId))
        .collection("class")
        .doc(String(periodId))
        .set(
          {
            id: data.id || "",
            subject: data.subject || "",
            teacher: data.teacher || "",
          },
          { merge: true }
        );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Error updating timetable:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
