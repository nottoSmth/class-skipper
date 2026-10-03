"use client";

import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { singletonFirestorePublic } from "../singleton/client.firebasePublic";

interface RoomSelectorProps {
  value?: string;
  onChange?: (room: string) => void;
  disabled?: boolean;
}

export default function RoomSelector({ value, onChange, disabled = false }: RoomSelectorProps) {
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
      <div className="relative w-full flex items-center gap-2">
        <select
          id="room-select"
          value={selectedRoom}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-xl text-slate-800 font-semibold text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-400 transition ${
            disabled
              ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed opacity-70"
              : "bg-slate-50 border-slate-200 focus:bg-white"
          }`}
        >
          {allRooms.map((r) => (
            <option key={r} value={r}>
              ห้อง {r}
            </option>
          ))}
        </select>
        {disabled && (
          <span title="ห้องถูกกำหนดโดยบัญชีของคุณ" className="shrink-0 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M12 1a5 5 0 00-5 5v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm3 7V6a3 3 0 10-6 0v2h6zm-3 4a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}