"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { singletonFirestorePublic } from "@/lib/client/singleton/client.firebasePublic";
import {
  formatDateKey,
  getPeriodKey,
  getAttendanceMap,
  saveAttendanceMap,
  subscribeToAttendance,
  parseCalendarPropertyDateKey,
} from "@/lib/client/attendanceStorage";
import { FaCheck, FaTimes, FaCalendarAlt } from "react-icons/fa";

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
const THAI_MONTH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

export interface WeekDayInfo {
  year: number;
  month: number;
  day: number;
  dateKey: string;
  dayOfWeek: number; // 1 = Monday ... 5 = Friday
}

interface TimetableProps {
  roomId?: string;
  weekDays?: WeekDayInfo[];
  weekLabel?: string;
  calendarStartKey?: string;
  calendarEndKey?: string;
}

function getDefaultWeekDays(): WeekDayInfo[] {
  const d = new Date();
  const dow = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const days: WeekDayInfo[] = [];
  for (let i = 0; i < 5; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    days.push({
      year: cur.getFullYear(),
      month: cur.getMonth() + 1,
      day: cur.getDate(),
      dateKey: formatDateKey(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()),
      dayOfWeek: i + 1,
    });
  }
  return days;
}

export default function Timetable({
  roomId = "67",
  weekDays,
  weekLabel,
  calendarStartKey,
  calendarEndKey,
}: TimetableProps) {
  const [timetableData, setTimetableData] = useState<TimetableData>({});
  const [loading, setLoading] = useState(true);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [calStart, setCalStart] = useState<string>(calendarStartKey || "");
  const [calEnd, setCalEnd] = useState<string>(calendarEndKey || "");

  useEffect(() => {
    if (calendarStartKey) setCalStart(calendarStartKey);
    if (calendarEndKey) setCalEnd(calendarEndKey);
  }, [calendarStartKey, calendarEndKey]);

  useEffect(() => {
    if (calendarStartKey && calendarEndKey) return;
    async function fetchCalendarProps() {
      try {
        const snap = await getDoc(
          doc(singletonFirestorePublic, "calendar", "properties")
        );
        if (snap.exists()) {
          const d = snap.data();
          if (!calendarStartKey && d["start-calendar"]) {
            setCalStart(parseCalendarPropertyDateKey(d["start-calendar"], ""));
          }
          if (!calendarEndKey && d["end-calendar"]) {
            setCalEnd(parseCalendarPropertyDateKey(d["end-calendar"], "", true));
          }
        }
      } catch (err) {
        console.error("Error fetching calendar properties in Timetable:", err);
      }
    }
    fetchCalendarProps();
  }, [calendarStartKey, calendarEndKey]);

  // Active days for this week (default to current week if none provided)
  const activeWeekDays = useMemo(() => {
    return weekDays && weekDays.length === 5 ? weekDays : getDefaultWeekDays();
  }, [weekDays]);

  const todayKey = useMemo(() => {
    const today = new Date();
    return formatDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
  }, []);

  // Subscribe to shared attendance state
  useEffect(() => {
    setAttendanceMap(getAttendanceMap());
    const unsub = subscribeToAttendance(() => {
      setAttendanceMap(getAttendanceMap());
    });
    return () => unsub();
  }, []);

  // Fetch timetable classes for the room
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

  // Toggle period attendance for specific date
  const togglePeriod = (dateKey: string, periodIndex: number) => {
    // Only allow interacting within [calStart, calEnd] and not in the future
    if (calStart && dateKey < calStart) return;
    if (calEnd && dateKey > calEnd) return;
    if (dateKey > todayKey) return;

    const pKey = getPeriodKey(dateKey, periodIndex);

    // Current state check
    let currentAttended = false;
    if (attendanceMap[pKey] !== undefined) {
      currentAttended = attendanceMap[pKey];
    } else if (attendanceMap[dateKey] !== undefined) {
      currentAttended = attendanceMap[dateKey];
    } else {
      // Default for past/today is absent (false), for future is false/neutral
      currentAttended = false;
    }

    const nextAttended = !currentAttended;
    const nextMap = { ...attendanceMap, [pKey]: nextAttended };

    // Also update day-level key if needed so it stays aligned
    setAttendanceMap(nextMap);
    saveAttendanceMap(nextMap);
  };

  // Quick action: set all periods of a day to attended or absent
  const setAllDayPeriods = (dayInfo: WeekDayInfo, attended: boolean) => {
    if (calStart && dayInfo.dateKey < calStart) return;
    if (calEnd && dayInfo.dateKey > calEnd) return;
    if (dayInfo.dateKey > todayKey) return;

    const dayName = DAYS[dayInfo.dayOfWeek - 1];
    const periods = timetableData[dayName];
    const nextMap = { ...attendanceMap, [dayInfo.dateKey]: attended };

    if (periods) {
      Object.keys(periods).forEach((pId) => {
        const pKey = getPeriodKey(dayInfo.dateKey, parseInt(pId, 10));
        nextMap[pKey] = attended;
      });
    }

    setAttendanceMap(nextMap);
    saveAttendanceMap(nextMap);
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
    <div className="w-full flex flex-col gap-3">
      {/* Week Header info */}
      {weekLabel && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <FaCalendarAlt className="text-pink-500" />
            <span>{weekLabel}</span>
          </div>
          <div className="text-xs text-slate-400">
            คลิกที่คาบเรียนเพื่อบันทึกสถานะ (มา / ขาด)
          </div>
        </div>
      )}

      {/* Scrollable Container for Timetable Grid */}
      <div className="w-full max-w-7xl mx-auto overflow-x-auto no-scrollbar">
        <div
          className="grid gap-1.5 p-1 w-fit mx-auto"
          style={{
            gridTemplateColumns: "115px 110px 120px 80px 110px 110px 80px 110px 110px 80px 110px 110px",
          }}
        >
          {/* Header Row */}
          {/* Day / Time Corner Header */}
          <div className="bg-slate-100/90 text-slate-700 font-bold rounded-xl p-2 text-xs flex items-center justify-center shadow-2xs">
            วัน / เวลา
          </div>

          {/* Column Headers */}
          {COLUMNS.map((col, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-xl text-xs font-semibold flex flex-col justify-center items-center text-center shadow-2xs ${col.type === "break" ? "text-slate-500 bg-slate-100/60" : "text-slate-700 bg-slate-100/90"
                }`}
            >
              <div>{col.label}</div>
              <div className="text-[9px] font-normal text-slate-400 mt-0.5">
                {col.time}
              </div>
            </div>
          ))}

          {/* Grid Body */}
          {activeWeekDays.map((dayInfo, dayIdx) => {
            const dayName = DAYS[dayInfo.dayOfWeek - 1];
            const isTodayRow = dayInfo.dateKey === todayKey;
            const isWithinRange =
              (!calStart || dayInfo.dateKey >= calStart) &&
              (!calEnd || dayInfo.dateKey <= calEnd);
            const isFutureRow = dayInfo.dateKey > todayKey || !isWithinRange;

            // Calculate scheduled period indexes for this day
            const dayPeriods = timetableData[dayName]
              ? Object.keys(timetableData[dayName]).map((p) => parseInt(p, 10))
              : [];

            // Determine day attendance status (Green = All attended, Yellow = Partial, Red = All absent)
            let dayCellBgClass = "bg-slate-100/90 text-slate-700";
            let dayStatusLabel: string | null = null;

            if (isFutureRow) {
              dayCellBgClass = "bg-slate-100/80 text-slate-500 border border-slate-200/50";
              dayStatusLabel = "ยังไม่ถึง";
            } else if (dayPeriods.length === 0) {
              // Free day with no classes scheduled
              dayCellBgClass = "bg-slate-100/90 text-slate-600";
              dayStatusLabel = "ไม่มีเรียน";
            } else {
              // Count how many periods are attended
              let attendedCount = 0;
              for (const p of dayPeriods) {
                const pKey = getPeriodKey(dayInfo.dateKey, p);
                if (attendanceMap[pKey] === true) {
                  attendedCount++;
                } else if (attendanceMap[pKey] === undefined && attendanceMap[dayInfo.dateKey] === true) {
                  attendedCount++;
                }
              }

              if (attendedCount === dayPeriods.length) {
                // All periods attended -> GREEN
                dayCellBgClass = "bg-emerald-400 text-white shadow-xs";
                dayStatusLabel = "มา (ครบ)";
              } else if (attendedCount === 0) {
                // All periods absent -> RED
                dayCellBgClass = "bg-rose-400 text-white shadow-xs";
                dayStatusLabel = "ขาด";
              } else {
                // Some periods attended, some absent -> YELLOW
                dayCellBgClass = "bg-amber-400 text-white shadow-xs";
                dayStatusLabel = "เข้าไม่ครบ";
              }
            }

            const todayRowRing = isTodayRow
              ? "ring-3 ring-pink-500 ring-offset-2 ring-offset-white shadow-md z-10"
              : "";

            return (
              <React.Fragment key={dayInfo.dateKey}>
                {/* Day Label Cell with exact date, color state (เขียว/แดง/เหลือง) & quick toggle buttons */}
                <div
                  className={`p-2 font-bold text-xs rounded-xl flex flex-col items-center justify-between text-center transition-all shadow-2xs gap-1.5 ${dayCellBgClass} ${todayRowRing}`}
                >
                  <div className="flex flex-col items-center w-full">
                    <span className="text-[12px] leading-tight font-extrabold">{dayName}</span>
                    <span className="text-[10px] font-medium opacity-90">
                      {dayInfo.day} {THAI_MONTH_SHORT[dayInfo.month - 1]}
                    </span>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                      {isTodayRow && (
                        <span className="text-[8px] bg-pink-600 text-white font-extrabold px-1.5 py-0.2 rounded-full leading-tight shadow-xs">
                          วันนี้
                        </span>
                      )}
                      {dayStatusLabel && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full leading-tight ${
                          dayPeriods.length > 0 ? "bg-black/15 text-white" : "bg-slate-200 text-slate-600"
                        }`}>
                          {dayStatusLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick toggle all periods for this day */}
                  {!isFutureRow && dayPeriods.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5 w-full justify-center">
                      <button
                        type="button"
                        onClick={() => setAllDayPeriods(dayInfo, true)}
                        className="px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95 bg-white/20 hover:bg-white/30 text-white backdrop-blur-xs border border-white/20 shadow-2xs"
                        title="เช็กมาเรียนทุกคาบในวันนี้"
                      >
                        <FaCheck size={7} /> มา
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllDayPeriods(dayInfo, false)}
                        className="px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition active:scale-95 bg-black/15 hover:bg-black/25 text-white border border-black/10 shadow-2xs"
                        title="เช็กขาดเรียนทุกคาบในวันนี้"
                      >
                        <FaTimes size={7} /> ขาด
                      </button>
                    </div>
                  )}
                </div>

                {/* Period & Break cells */}
                {COLUMNS.map((col, colIdx) => {
                  if (col.type === "break") {
                    if (dayIdx !== 0) return null;
                    return (
                      <div
                        key={`break-${colIdx}`}
                        className="bg-slate-100/60 text-center flex flex-col items-center justify-center p-1.5 rounded-xl border border-slate-200/50"
                        style={{ gridRow: `span ${activeWeekDays.length}` }}
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
                    const classInfo = timetableData[dayName]?.[col.periodIndex!];
                    if (classInfo) {
                      const pKey = getPeriodKey(dayInfo.dateKey, col.periodIndex!);

                      // Determine attendance state for this period on this specific date
                      let isAttended = false;
                      let isDecided = false;

                      if (!isWithinRange) {
                        isAttended = false;
                        isDecided = false;
                      } else if (attendanceMap[pKey] !== undefined) {
                        isAttended = attendanceMap[pKey];
                        isDecided = true;
                      } else if (attendanceMap[dayInfo.dateKey] !== undefined) {
                        isAttended = attendanceMap[dayInfo.dateKey];
                        isDecided = true;
                      } else {
                        // Past / Today date default is ABSENT (ขาด) as requested!
                        if (!isFutureRow) {
                          isAttended = false;
                          isDecided = true;
                        } else {
                          isAttended = false;
                          isDecided = false; // future neutral
                        }
                      }

                      // Cell background styling
                      let cellBgClass: string;
                      if (!isWithinRange) {
                        cellBgClass = "bg-slate-100/80 text-slate-400 border border-slate-200/50 cursor-not-allowed";
                      } else if (isFutureRow && !isDecided) {
                        cellBgClass = "bg-slate-100/80 text-slate-400 border border-slate-200/50 hover:bg-slate-200/70 cursor-pointer";
                      } else if (isAttended) {
                        cellBgClass = "bg-emerald-400 hover:bg-emerald-500 text-white font-medium shadow-xs cursor-pointer";
                      } else {
                        // Absent (default for past/today or explicitly marked)
                        cellBgClass = "bg-rose-400 hover:bg-rose-500 text-white font-medium shadow-xs cursor-pointer";
                      }

                      const todayPeriodBorder = isTodayRow ? "ring-1 ring-pink-300" : "";

                      return (
                        <div
                          key={`period-${dayInfo.dateKey}-${colIdx}`}
                          onClick={() => isWithinRange && togglePeriod(dayInfo.dateKey, col.periodIndex!)}
                          className={`p-2 text-[11px] rounded-xl flex flex-col justify-between gap-0.5 transition-all duration-150 leading-tight select-none ${cellBgClass} ${todayPeriodBorder} ${
                            isWithinRange ? "hover:brightness-105 active:scale-[0.98]" : ""
                          } min-h-[64px]`}
                          title={
                            !isWithinRange
                              ? "อยู่นอกช่วงเวลาภาคเรียน"
                              : isFutureRow && !isDecided
                                ? "วันที่ยังมาไม่ถึง (คลิกเพื่อบันทึกล่วงหน้า)"
                                : isAttended
                                  ? "มาเรียน (คลิกเพื่อเปลี่ยนเป็นขาด)"
                                  : "ขาดเรียน (คลิกเพื่อเปลี่ยนเป็นมา)"
                          }
                        >
                          <div>
                            <span className="font-semibold leading-tight line-clamp-2 block">
                              {classInfo.subject}
                            </span>
                            {classInfo.id && (
                              <span className="text-[10px] opacity-90 block font-medium mt-0.5">
                                {classInfo.id}
                              </span>
                            )}
                            {classInfo.teacher && (
                              <span className="text-[9px] opacity-75 italic font-normal line-clamp-1">
                                {classInfo.teacher}
                              </span>
                            )}
                          </div>

                          <div className="text-[8px] font-bold self-end px-1.5 py-0.2 rounded bg-black/15 uppercase tracking-wider">
                            {isFutureRow && !isDecided ? "ยังไม่ถึง" : isAttended ? "มา" : "ขาด"}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={`period-${dayInfo.dateKey}-${colIdx}`}
                          className="p-2 text-[10px] bg-slate-50/50 text-slate-300 italic rounded-xl flex items-center justify-center hover:bg-slate-100/50 transition-colors duration-150 min-h-[64px]"
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
    </div>
  );
}
