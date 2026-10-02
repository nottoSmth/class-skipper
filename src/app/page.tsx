"use client";

import { useState } from "react";
import BuildingRoomSelector from "@/lib/client/components/BuildingRoomSelector";
import Calendar from "@/lib/client/components/Calendar";
import AbsenceCalculator from "@/lib/client/components/AbsenceCalculator";
import { Header } from "@/lib/client/components/Components";

export default function Home() {
  const [selectedRoom, setSelectedRoom] = useState("67");

  return (
    <div className="min-h-screen bg-slate-50/40">
      <Header />
      <main className="max-w-4xl mx-auto flex flex-col items-center justify-start pt-20 pb-20 px-4 gap-6">
        {/* Room Selector */}
        <BuildingRoomSelector
          value={selectedRoom}
          onChange={(newRoom) => setSelectedRoom(newRoom)}
        />

        {/* Calendar with Highlighted Today and Auto-scroll to Current Month */}
        <Calendar roomId={selectedRoom} />

        {/* Absence Calculator & Quota Tracker */}
        <AbsenceCalculator roomId={selectedRoom} />
      </main>
    </div>
  );
}
