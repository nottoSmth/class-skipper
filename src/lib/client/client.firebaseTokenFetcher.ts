"use client";

import { useEffect } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { singletonFirebaseAuth } from "@/lib/client/singleton/client.firebaseAuth";
import { handleClientLogout } from "@/lib/client/auth";

export async function logInToFirebase() {
  console.log("Attempting to log in to Firebase...");
  console.log("API Key loaded (first 5 chars):", process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 5));

  async function fetchToken() {
    const storedExpiry = localStorage.getItem("tokenExpiry");
    const storedToken = localStorage.getItem("token");
    if (storedExpiry && storedToken && parseInt(storedExpiry) > Date.now()) return;

    console.log("Token expired fetching new Firebase token...");
    const res = await fetch("/api/get-firebase-token");

    if (res.status === 401) {
      console.warn("Session expired or invalid, logging out automatically...");
      await handleClientLogout("/login");
      return;
    }

    if (!res.ok) {
      console.error("Failed to fetch Firebase token", res.status);
      return;
    }

    const data = await res.json();
    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("tokenExpiry", data.expiresAt);
    }
  }

  async function signInWithToken() {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      console.log("signing in to firebase with token:", "**HIDDEN**");
      await signInWithCustomToken(singletonFirebaseAuth, token);
    } catch (err: unknown) {
      console.error("Firebase custom token authentication failed:", err);
      const errorCode = (err as { code?: string })?.code;
      if (
        errorCode === "auth/custom-token-mismatch" ||
        errorCode === "auth/invalid-custom-token"
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("tokenExpiry");
        await handleClientLogout("/login");
      }
    }
  }

  await fetchToken();
  await signInWithToken();
}

export default function FirebaseTokenFetcher() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/login") {
      return;
    }

    // Run immediately on mount
    logInToFirebase();

    // Check periodically (every 2 minutes)
    const intervalId = setInterval(() => {
      if (typeof window !== "undefined" && window.location.pathname === "/login") {
        return;
      }
      logInToFirebase();
    }, 2 * 60 * 1000);

    // Also check when the user returns to the tab/window
    const handleFocus = () => {
      if (typeof window !== "undefined" && window.location.pathname === "/login") {
        return;
      }
      logInToFirebase();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}