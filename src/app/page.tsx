"use client";

import { useState, useEffect } from "react";
import BuildingRoomSelector from "@/lib/client/components/BuildingRoomSelector";
import Calendar from "@/lib/client/components/Calendar";
import AbsenceCalculator from "@/lib/client/components/AbsenceCalculator";
import { Header } from "@/lib/client/components/Components";
import { doc, getDoc } from "firebase/firestore";
import { singletonFirestorePublic } from "@/lib/client/singleton/client.firebasePublic";

export default function Home() {
  const [selectedRoom, setSelectedRoom] = useState("67");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function loadUserRoom() {
      if (typeof window === "undefined") return;

      const stored = localStorage.getItem("userData");
      if (!stored) {
        setIsLoggedIn(false);
        return;
      }

      let userData: { username: string };
      try {
        userData = JSON.parse(stored);
      } catch {
        setIsLoggedIn(false);
        return;
      }

      setIsLoggedIn(true);

      try {
        const userDoc = await getDoc(
          doc(singletonFirestorePublic, "users", userData.username)
        );
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data?.room) {
            setSelectedRoom(String(data.room));
          }
        }
      } catch (e) {
        console.error("Failed to fetch user room:", e);
      }
    }

    loadUserRoom();
  }, []);

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
