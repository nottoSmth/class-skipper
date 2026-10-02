"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { singletonFirestorePublic } from "@/lib/client/singleton/client.firebasePublic";

// 1. Define types for the Timetable data structure
interface PeriodData {
  subject: string;
  id?: string;
  teacher?: string;
}

interface TimetableData {
  [day: string]: {
    [periodIndex: number]: PeriodData;
  };
}

// 2. Define columns configuration chronologically
interface ColumnConfig {
  type: "period" | "break";
  label: string;
  time: string;
  periodIndex?: number;
  durationMinutes: number;
}

const COLUMNS: ColumnConfig[] = [
  { type: "period", label: "Period 1", time: "07:50 - 08:40", periodIndex: 1, durationMinutes: 50 },
  { type: "period", label: "Period 2", time: "08:40 - 09:30", periodIndex: 2, durationMinutes: 50 },
  { type: "break", label: "Break", time: "09:30 - 09:40", durationMinutes: 10 },
  { type: "period", label: "Period 3", time: "09:40 - 10:30", periodIndex: 3, durationMinutes: 50 },
  { type: "period", label: "Period 4", time: "10:30 - 11:20", periodIndex: 4, durationMinutes: 50 },
  { type: "break", label: "Lunch", time: "11:20 - 12:20", durationMinutes: 60 },
  { type: "period", label: "Period 5", time: "12:20 - 13:10", periodIndex: 5, durationMinutes: 50 },
  { type: "period", label: "Period 6", time: "13:10 - 14:00", periodIndex: 6, durationMinutes: 50 },
  { type: "break", label: "Break", time: "14:00 - 14:10", durationMinutes: 10 },
  { type: "period", label: "Period 7", time: "14:10 - 15:00", periodIndex: 7, durationMinutes: 50 },
  { type: "period", label: "Period 8", time: "15:00 - 15:50", periodIndex: 8, durationMinutes: 50 },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export interface AttendanceRecord {
  day: string;
  periodIndex: number;
  isAttended: boolean;
}

interface TimetableProps {
  roomId?: string;
}

export default function Timetable({ roomId = "67" }: TimetableProps) {
  const [timetableData, setTimetableData] = useState<TimetableData>({});
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // Identify today's day of the week
  const todayDow = useMemo(() => new Date().getDay(), []); // 0 = Sun, 1 = Mon ... 5 = Fri, 6 = Sat
  const isToday = (dayIdx: number) => dayIdx + 1 === todayDow;

  // Load attendance records from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`class_skipper_timetable_records_${roomId}`);
      if (stored) {
        setRecords(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error loading timetable attendance:", e);
    }
  }, [roomId]);

  useEffect(() => {
    async function fetchTimetable() {
      setLoading(true);
      const newData: TimetableData = {};

      try {
        const fetchPromises = DAYS.map(async (dayName, index) => {
          const dayId = index + 1;
          newData[dayName] = {};

          const classRef = collection(
            singletonFirestorePublic,
            `rooms/${roomId}/table/${dayId}/class`
          );

          const snapshot = await getDocs(classRef);
          snapshot.forEach((doc) => {
            const periodData = doc.data();
            const periodId = parseInt(doc.id, 10);

            if (periodId >= 1 && periodId <= 8) {
              newData[dayName][periodId] = {
                subject: periodData.subject,
                id: periodData.id,
                teacher: periodData.teacher,
              };
            }
          });
        });

        await Promise.all(fetchPromises);
      } catch (error) {
        console.error("Error fetching timetable data:", error);
      } finally {
        setTimetableData(newData);
        setLoading(false);
      }
    }

    fetchTimetable();
  }, [roomId]);

  // 3-state toggle: Default -> Attended (Green) -> Absent (Red) -> Default
  const toggleAttendance = (day: string, periodIndex: number) => {
    setRecords((prev) => {
      const record = prev.find((r) => r.day === day && r.periodIndex === periodIndex);
      const filtered = prev.filter((r) => !(r.day === day && r.periodIndex === periodIndex));

      let updated: AttendanceRecord[];
      if (!record) {
        // 1st click: Attended (Green)
        updated = [...filtered, { day, periodIndex, isAttended: true }];
      } else if (record.isAttended) {
        // 2nd click: Absent (Red)
        updated = [...filtered, { day, periodIndex, isAttended: false }];
      } else {
        // 3rd click: Reset to default
        updated = filtered;
      }

      try {
        localStorage.setItem(`class_skipper_timetable_records_${roomId}`, JSON.stringify(updated));
      } catch (e) {
        console.error("Error saving timetable attendance:", e);
      }
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="text-slate-500 font-medium py-8 flex items-center justify-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500" />
        กำลังโหลดตารางเรียนห้อง {roomId}...
      </div>
    );
  }

  return (
    // Scrollable container for the minimal grid
    <div className="w-full max-w-7xl mx-auto overflow-x-auto no-scrollbar">
      <div
        className="grid gap-1.5 p-1 w-fit mx-auto"
        style={{
          gridTemplateColumns: "85px 110px 120px 80px 110px 110px 80px 110px 110px 80px 110px 110px",
        }}
      >
        {/* Header Row */}
        {/* Day / Time Corner Header */}
        <div className="bg-slate-100/90 text-slate-700 font-bold rounded-xl p-2 text-xs flex items-center justify-center shadow-2xs">
          Day / Time
        </div>
        {/* Column Headers */}
        {COLUMNS.map((col, idx) => (
          <div
            key={idx}
            className={`p-2 rounded-xl text-xs font-semibold flex flex-col justify-center items-center text-center shadow-2xs ${
              col.type === "break" ? "text-slate-500 bg-slate-100/60" : "text-slate-700 bg-slate-100/90"
            }`}
          >
            <div>{col.label}</div>
            <div className="text-[9px] font-normal text-slate-400 mt-0.5">
              {col.time}
            </div>
          </div>
        ))}

        {/* Grid Body */}
        {DAYS.map((day, dayIdx) => {
          const isTodayRow = isToday(dayIdx);

          return (
            <React.Fragment key={day}>
              {/* Day Label Cell - Highlight if Today */}
              <div
                className={`p-2 font-bold text-xs rounded-xl flex flex-col items-center justify-center text-center transition-all shadow-2xs ${
                  isTodayRow
                    ? "bg-pink-500 text-white shadow-sm ring-2 ring-pink-400 ring-offset-1"
                    : "text-slate-700 bg-slate-100/90"
                }`}
              >
                <span>{day}</span>
                {isTodayRow && (
                  <span className="text-[9px] bg-white/25 text-white font-extrabold px-1.5 py-0.2 rounded-full mt-0.5 leading-tight">
                    วันนี้
                  </span>
                )}
              </div>

              {/* Period & Break cells */}
              {COLUMNS.map((col, colIdx) => {
                if (col.type === "break") {
                  // Only render the break cell once, spanning vertically across all rows
                  if (dayIdx !== 0) return null;
                  return (
                    <div
                      key={`break-${colIdx}`}
                      className="bg-slate-100/60 text-center flex flex-col items-center justify-center p-1.5 rounded-xl border border-slate-200/50"
                      style={{ gridRow: `span ${DAYS.length}` }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {col.label}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5 block font-mono">
                        {col.durationMinutes}m
                      </span>
                    </div>
                  );
                } else {
                  const classInfo = timetableData[day]?.[col.periodIndex!];
                  if (classInfo) {
                    // Find the dynamic state for this specific day and period
                    const record = records.find(
                      (r) => r.day === day && r.periodIndex === col.periodIndex
                    );
                    let cellBgClass: string;
                    if (record) {
                      cellBgClass = record.isAttended
                        ? "bg-emerald-400 hover:bg-emerald-500 text-white font-medium shadow-xs"
                        : "bg-rose-400 hover:bg-rose-500 text-white font-medium shadow-xs";
                    } else {
                      // Default state is slate
                      cellBgClass = "bg-slate-100 hover:bg-slate-200 text-slate-800";
                    }

                    // Extra subtle border highlight if today
                    const todayPeriodBorder = isTodayRow
                      ? "ring-1 ring-pink-300/80"
                      : "";

                    return (
                      <div
                        key={`period-${day}-${colIdx}`}
                        onClick={() => toggleAttendance(day, col.periodIndex!)}
                        className={`p-2 text-[11px] rounded-xl flex flex-col justify-center gap-0.5 transition-all duration-150 leading-tight cursor-pointer select-none ${cellBgClass} ${todayPeriodBorder} hover:brightness-105 active:scale-[0.98]`}
                        title={
                          record
                            ? record.isAttended
                              ? "มาเรียน (คลิกเพื่อเปลี่ยนเป็นขาด)"
                              : "ขาดเรียน (คลิกเพื่อยกเลิก)"
                            : "คลิกเพื่อเช็กชื่อ"
                        }
                      >
                        <span className="font-semibold leading-tight line-clamp-2">
                          {classInfo.subject}
                        </span>
                        {classInfo.id && (
                          <span className="text-[10px] opacity-90 flex items-center gap-0.5 font-medium">
                            {classInfo.id}
                          </span>
                        )}
                        {classInfo.teacher && (
                          <span className="text-[9px] opacity-75 italic font-normal line-clamp-1">
                            {classInfo.teacher}
                          </span>
                        )}
                        {record && (
                          <div className="text-[8px] font-bold mt-0.5 self-end px-1 rounded bg-black/10">
                            {record.isAttended ? "มา" : "ขาด"}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={`period-${day}-${colIdx}`}
                        className="p-2 text-[10px] bg-slate-50/50 text-slate-300 italic rounded-xl flex items-center justify-center hover:bg-slate-100/50 transition-colors duration-150"
                      >
                        Free
                      </div>
                    );
                  }
                }
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
