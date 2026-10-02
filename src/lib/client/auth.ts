import { signOut } from "firebase/auth";
import { singletonFirebaseAuth } from "@/lib/client/singleton/client.firebaseAuth";

/**
 * Performs a complete client-side and server-side logout:
 * 1. Calls the /api/logout endpoint to clear the HTTP-only session cookie.
 * 2. Clears client-side authentication and cache from localStorage.
 * 3. Signs out from Firebase client SDK.
 * 4. Redirects the user to /login (or reloads if already there).
 */
export async function handleClientLogout(redirectTo: string = "/login") {
  try {
    await fetch("/api/logout", {
      method: "POST",
    });
  } catch (err) {
    console.error("Failed to call logout API:", err);
  }

  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem("userData");
      localStorage.removeItem("token");
      localStorage.removeItem("tokenExpiry");
      localStorage.clear();
    }
  } catch (err) {
    console.error("Failed to clear localStorage:", err);
  }

  try {
    if (singletonFirebaseAuth.currentUser) {
      await signOut(singletonFirebaseAuth);
    }
  } catch (err) {
    console.error("Failed to sign out from Firebase:", err);
  }

  if (typeof window !== "undefined") {
    if (window.location.pathname !== redirectTo) {
      window.location.href = redirectTo;
    }
  }
}
