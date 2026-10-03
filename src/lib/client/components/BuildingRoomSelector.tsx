"use client";

import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { singletonFirestorePublic } from "../singleton/client.firebasePublic";

interface RoomSelectorProps {
  value?: string;
  onChange?: (room: string) => void;
}

export default function RoomSelector({ value, onChange }: RoomSelectorProps) {
  const [internalRoom, setInternalRoom] = useState(value || "67");
  const [allRooms, setAllRooms] = useState<string[]>([]);

  const selectedRoom = value !== undefined ? value : internalRoom;

  useEffect(() => {
    async function fetchAllRoom() {
      try {
        const snapshot = await getDocs(
          collection(singletonFirestorePublic, "rooms")
        );
        const rooms: string[] = snapshot.docs.map((doc) => doc.id);
        setAllRooms(rooms);
      } catch (e) {
        console.error("Error fetching rooms:", e);
      }
    }
    fetchAllRoom();
  }, []);

  const handleChange = (newRoom: string) => {
    setInternalRoom(newRoom);
    if (onChange) {
      onChange(newRoom);
    }
  };

  return (
    <div className="w-full max-w-xl flex items-center justify-between gap-3 bg-white p-3 px-4 rounded-2xl border border-slate-200 shadow-2xs">
      <label htmlFor="room-select" className="text-xs font-bold text-slate-600 shrink-0">
        เลือกห้องเรียน:
      </label>
      <select
        id="room-select"
        value={selectedRoom}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-semibold text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-400 focus:bg-white transition"
      >
        {allRooms.map((r) => (
          <option key={r} value={r}>
            ห้อง {r}
          </option>
        ))}
      </select>
    </div>
  );
}