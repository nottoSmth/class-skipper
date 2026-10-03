"use client";

import { useState, useEffect } from "react";
import BuildingRoomSelector from "@/lib/client/components/BuildingRoomSelector";
import Calendar from "@/lib/client/components/Calendar";
import AbsenceCalculator from "@/lib/client/components/AbsenceCalculator";
import { Header } from "@/lib/client/components/Components";
import { doc, getDoc } from "firebase/firestore";
import { singletonFirestore } from "@/lib/client/singleton/client.firebaseAuth";
import { useFirebaseContext } from "@/lib/client/context/firebaseContext";
import { pullAttendanceFromFirestore } from "@/lib/client/attendanceSync";

function getStoredUsername(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("userData");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.username ?? null;
  } catch {
    return null;
  }
}

export default function Home() {
  // Detect login state synchronously from localStorage — avoids a flash
  const [loggedInUsername] = useState<string | null>(() => getStoredUsername());

  const [selectedRoom, setSelectedRoom] = useState("67");
  const { isFirebaseReady } = useFirebaseContext();

  // Fetch the user's assigned room only after Firebase auth is ready
  // (Firestore rules: allow read if request.auth.uid == userId)
  useEffect(() => {
    if (!isFirebaseReady || !loggedInUsername) return;

    async function loadUserRoom() {
      try {
        const userDoc = await getDoc(
          doc(singletonFirestore, "users", loggedInUsername!)
        );
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data?.room) {
            setSelectedRoom(String(data.room));
          }
        }
        await pullAttendanceFromFirestore(loggedInUsername!);
      } catch (e) {
        console.error("Failed to fetch user room:", e);
      }
    }

    loadUserRoom();
  }, [isFirebaseReady, loggedInUsername]);

  const isLoggedIn = loggedInUsername !== null;

  return (
    <div className="min-h-screen bg-slate-50/40">
      <Header />
      <main className="max-w-4xl mx-auto flex flex-col items-center justify-start pt-20 pb-20 px-4 gap-6">
        {/* Room Selector */}
        <BuildingRoomSelector
          value={selectedRoom}
          onChange={(newRoom) => setSelectedRoom(newRoom)}
          disabled={isLoggedIn}
        />

        {/* Calendar with Highlighted Today and Auto-scroll to Current Month */}
        <Calendar roomId={selectedRoom} />

        {/* Absence Calculator & Quota Tracker */}
        <AbsenceCalculator roomId={selectedRoom} />
      </main>
    </div>
  );
}
