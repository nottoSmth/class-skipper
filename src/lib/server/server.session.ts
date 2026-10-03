// lib/server/server.session.ts
// Reads the JWT session cookie and resolves the user username + role from Firestore.

import { cookies } from "next/headers";
import { verifyTokenServer } from "@/lib/server/server.tokenAuth";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";

export type UserRole = "admin" | "privileged" | "user";

export interface SessionUser {
  username: string;
  role: UserRole;
  room: string;
}

/**
 * Returns the session user (username, role, room) for the current request,
 * or null if the user is not authenticated.
 *
 * This must only be called from Server Components or Route Handlers.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  const username = await verifyTokenServer(sessionCookie?.value);
  if (!username || typeof username !== "string") return null;

  try {
    const db = getFirestoreDB();
    const userSnap = await db.collection("users").doc(username).get();
    if (!userSnap.exists) return null;

    const data = userSnap.data()!;
    const role: UserRole =
      data.role === "admin"
        ? "admin"
        : data.role === "privileged"
          ? "privileged"
          : "user";

    return {
      username,
      role,
      room: String(data.room ?? ""),
    };
  } catch {
    return null;
  }
}
