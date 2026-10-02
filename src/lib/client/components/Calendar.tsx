"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { FaAngleLeft, FaAngleRight, FaCalendarDay } from "react-icons/fa";
import { singletonFirestorePublic } from "@/lib/client/singleton/client.firebasePublic";
import { doc, getDoc } from "firebase/firestore";
import Timetable from "@/lib/client/components/Timetable";
import {
  formatDateKey,
  getAttendanceMap,
  saveAttendanceMap,
  subscribeToAttendance,
} from "@/lib/client/attendanceStorage";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type Day = {
  day: number;
  month: number;
  year: number;
};

export type DayData = {
  day: Day;
  isDayOff: boolean;
  isAttened: boolean;
  isHaveNote: boolean;
};

export function isSameDay(d1: Day, d2: Day): boolean {
  return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
}

interface CalendarProps {
  roomId?: string;
}

export default function Calendar({ roomId = "67" }: CalendarProps) {
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [dayOffCache, setDayOffCache] = useState<Record<string, boolean[]>>({});
  const [nowMonth, setNowMonth] = useState<Day>({ day: 0, month: 0, year: 0 });
  const [allMonths, setAllMonths] = useState<Day[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasAutoScrolled = useRef(false);

  // Today reference
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDayNum = today.getDate();

  // 1. Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  // 2. Load attendance from storage & listen to updates
  useEffect(() => {
    setAttendanceMap(getAttendanceMap());
    const unsub = subscribeToAttendance(() => {
      setAttendanceMap(getAttendanceMap());
    });
    return () => unsub();
  }, []);

  // 3. Fetch calendar range (start/end months)
  useEffect(() => {
    async function fetchCalendarRange() {
      try {
        const snap = await getDoc(
          doc(singletonFirestorePublic, "calendar", "properties")
        );

        if (!snap.exists()) return;

        const data = snap.data();
        const startDate = new Date(`${data["start-calendar"]}-01`);
        const endDate = new Date(`${data["end-calendar"]}-01`);

        const startCalendar: Day = {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate(),
        };

        const endCalendar: Day = {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate(),
        };

        const result: Day[] = [];
        let y = startCalendar.year;
        let m = startCalendar.month;
        while (y < endCalendar.year || (y === endCalendar.year && m <= endCalendar.month)) {
          result.push({ year: y, month: m, day: 1 });
          m++;
          if (m > 12) {
            m = 1;
            y++;
          }
        }
        setAllMonths(result);
      } catch (err) {
        console.error("Error fetching calendar range:", err);
      }
    }
    fetchCalendarRange();
  }, []);

  // 4. Feature: ตอน reload เว็บ ให้เลื่อนไปเดือน ปัจจุบัน
  useEffect(() => {
    if (allMonths.length === 0 || hasAutoScrolled.current) return;

    const targetIdx = allMonths.findIndex(
      (m) => m.year === currentYear && m.month === currentMonth
    );

    const idx = targetIdx !== -1 ? targetIdx : 0;
    const targetMonth = allMonths[idx];

    setNowMonth({
      year: targetMonth.year,
      month: targetMonth.month,
      day: currentDayNum,
    });

    // Ensure DOM is ready, then scroll to current month element
    const timer = setTimeout(() => {
      const el = monthRefs.current[idx];
      if (el && scrollRef.current) {
        el.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
        hasAutoScrolled.current = true;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [allMonths, currentYear, currentMonth, currentDayNum]);

  // 5. Fetch day-offs for the active/visible month
  useEffect(() => {
    if (!nowMonth.year || !nowMonth.month) return;

    const monthKey = `${nowMonth.year}-${String(nowMonth.month).padStart(2, "0")}`;
    if (dayOffCache[monthKey]) return; // already cached

    async function fetchDayOff(key: string) {
      try {
        const ref = doc(
          singletonFirestorePublic,
          "calendar",
          "properties",
          "day-off",
          key
        );
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setDayOffCache((prev) => ({ ...prev, [key]: new Array(31).fill(false) }));
          return;
        }

        const data = snap.data();
        const binNumber = data?.bin ?? 0;
        const bin: boolean[] = Array.from(
          { length: 31 },
          (_, i) => ((binNumber >> i) & 1) === 1
        );
        setDayOffCache((prev) => ({ ...prev, [key]: bin }));
      } catch (err) {
        console.error("Error fetching day-off:", err);
      }
    }

    fetchDayOff(monthKey);
  }, [nowMonth, dayOffCache]);

  // 6. Intersection Observer for month visibility
  useEffect(() => {
    if (allMonths.length === 0) return;

    const observers: IntersectionObserver[] = [];

    monthRefs.current.forEach((el, idx) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const { year, month } = allMonths[idx];
            setNowMonth((prev) => ({ year, month, day: prev.day || 1 }));
          }
        },
        {
          root: scrollRef.current,
          threshold: 0.5,
        }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [allMonths]);

  // Navigation handlers
  const scroll = (dir: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir * scrollRef.current.clientWidth,
      behavior: "smooth",
    });
  };

  const scrollToCurrentMonth = () => {
    const targetIdx = allMonths.findIndex(
      (m) => m.year === currentYear && m.month === currentMonth
    );
    if (targetIdx !== -1 && monthRefs.current[targetIdx]) {
      monthRefs.current[targetIdx]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  };

  // Click on a date: 3-state cycle (Default -> Attended (Green) -> Absent (Red) -> Default)
  const handleDayClick = (date: Day) => {
    const monthKey = `${date.year}-${String(date.month).padStart(2, "0")}`;
    const isDayOff = !!dayOffCache[monthKey]?.[date.day - 1];
    const dow = new Date(date.year, date.month - 1, date.day).getDay();

    // Weekend or day-off cannot be modified
    if (isDayOff || dow === 0 || dow === 6) return;

    const dateKey = formatDateKey(date.year, date.month, date.day);
    const currentVal = attendanceMap[dateKey];

    const nextMap = { ...attendanceMap };
    if (currentVal === undefined) {
      // 1st click: มาเรียน (Attended / Green)
      nextMap[dateKey] = true;
    } else if (currentVal === true) {
      // 2nd click: ขาดเรียน (Absent / Red - counts in Absence Calculator)
      nextMap[dateKey] = false;
    } else {
      // 3rd click: Reset to neutral slate
      delete nextMap[dateKey];
    }

    setAttendanceMap(nextMap);
    saveAttendanceMap(nextMap);
  };

  return (
    <div className="max-w-xl mx-auto relative flex flex-col items-center justify-center">
      {/* Top Toolbar */}
      <div className="w-full flex justify-between items-center mb-3 px-1">
        {/* Current Month Shortcut Button */}
        <button
          type="button"
          onClick={scrollToCurrentMonth}
          className="px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-600 font-semibold text-xs border border-pink-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
          title="เลื่อนไปยังเดือนปัจจุบัน"
        >
          <FaCalendarDay size={12} />
          <span>เดือนปัจจุบัน</span>
        </button>

        {/* Previous / Next Arrows */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:cursor-pointer transition-all active:scale-95 shadow-xs"
            title="เดือนก่อนหน้า"
          >
            <FaAngleLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:cursor-pointer transition-all active:scale-95 shadow-xs"
            title="เดือนถัดไป"
          >
            <FaAngleRight size={16} />
          </button>
        </div>
      </div>

      {/* Month Carousel */}
      <div
        ref={scrollRef}
        className="flex w-xl gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
      >
        {allMonths.map((month, monthIdx) => {
          const monthKey = `${month.year}-${String(month.month).padStart(2, "0")}`;
          const isThisMonthCurrent =
            month.year === currentYear && month.month === currentMonth;

          const firstDow = new Date(month.year, month.month - 1, 1).getDay();
          const daysInMonth = new Date(month.year, month.month, 0).getDate();
          const daysInPrevMonth = new Date(
            month.year,
            month.month - 1,
            0
          ).getDate();

          const cells = Array.from({ length: 42 }).map((_, i) => {
            const dateNum = i - firstDow + 1;
            if (dateNum < 1)
              return {
                dateNumber: daysInPrevMonth + dateNum,
                isInThisMonth: false,
              };
            if (dateNum > daysInMonth)
              return {
                dateNumber: dateNum - daysInMonth,
                isInThisMonth: false,
              };
            return { dateNumber: dateNum, isInThisMonth: true };
          });

          return (
            <div
              key={monthIdx}
              ref={(el) => {
                monthRefs.current[monthIdx] = el;
              }}
              className="snap-start shrink-0 w-full min-w-xl snap-center bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs"
            >
              {/* Month & Year Title Header */}
              <div className="flex mb-3 gap-2 items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
                    {MONTH_NAMES[month.month - 1]}
                  </div>
                  <div className="text-lg font-medium text-slate-500">
                    {month.year}
                  </div>
                </div>

                {isThisMonthCurrent && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-600 border border-pink-200">
                    เดือนนี้
                  </span>
                )}
              </div>

              {/* Day Labels Header */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                {DAY_LABELS.map((label, idx) => (
                  <div
                    key={idx}
                    className={`py-1.5 rounded-lg text-center text-xs font-semibold ${
                      label === "Sun"
                        ? "text-red-500 bg-red-50/60"
                        : label === "Sat"
                        ? "text-violet-700 bg-violet-50/60"
                        : "text-slate-600 bg-slate-100/70"
                    }`}
                  >
                    {label}
                  </div>
                ))}
                <div className="py-1.5 rounded-lg bg-pink-50 text-pink-500 font-semibold text-center text-xs flex items-center justify-center">
                  Week
                </div>
              </div>

              {/* Day Grid & Week Rows */}
              <div className="grid grid-cols-8 grid-rows-6 gap-1">
                {(() => {
                  const weeks = Array.from({ length: 6 }).map((_, weekIdx) => {
                    return cells.slice(weekIdx * 7, (weekIdx + 1) * 7);
                  });

                  return weeks.map((weekCells, weekIdx) => (
                    <React.Fragment key={weekIdx}>
                      {weekCells.map((cell, dayIdx) => {
                        const globalIdx = weekIdx * 7 + dayIdx;
                        const isSunday = globalIdx % 7 === 0;
                        const isSaturday = globalIdx % 7 === 6;

                        if (!cell.isInThisMonth) {
                          return (
                            <div
                              key={globalIdx}
                              className={`h-12 px-2 py-1 rounded-xl bg-slate-50/60 flex flex-col justify-start text-xs ${
                                isSunday ? "text-red-200" : "text-slate-300"
                              }`}
                            >
                              <span>{cell.dateNumber}</span>
                            </div>
                          );
                        }

                        const currentDay: Day = {
                          year: month.year,
                          month: month.month,
                          day: cell.dateNumber,
                        };

                        const dateKey = formatDateKey(
                          currentDay.year,
                          currentDay.month,
                          currentDay.day
                        );
                        const isDayOff = !!dayOffCache[monthKey]?.[cell.dateNumber - 1];
                        const attendanceStatus = attendanceMap[dateKey];
                        const isClickable = !isDayOff && !isSunday && !isSaturday;

                        // Feature: highlight วันนี้ว่าอยู่ที่ไหน
                        const isToday =
                          currentDay.year === currentYear &&
                          currentDay.month === currentMonth &&
                          currentDay.day === currentDayNum;

                        let cellClass: string;
                        if (isDayOff) {
                          cellClass = "bg-violet-100 text-violet-500/80";
                        } else if (attendanceStatus === true) {
                          cellClass = "bg-emerald-400 text-white shadow-xs font-semibold";
                        } else if (attendanceStatus === false) {
                          cellClass = "bg-rose-400 text-white shadow-xs font-semibold";
                        } else {
                          cellClass = `bg-slate-100/90 hover:bg-slate-200/80 ${
                            isSunday
                              ? "text-red-500"
                              : isSaturday
                              ? "text-violet-800"
                              : "text-slate-800"
                          }`;
                        }

                        // Highlight วันนี้: Ring + Pink Accent + Badge
                        const todayHighlightClass = isToday
                          ? "ring-2 ring-pink-500 ring-offset-2 ring-offset-white shadow-sm z-10"
                          : "";

                        return (
                          <div
                            key={globalIdx}
                            className={`h-12 px-1.5 py-1 rounded-xl flex flex-col justify-between text-xs transition-all ${cellClass} ${todayHighlightClass} ${
                              isClickable
                                ? "cursor-pointer select-none active:scale-95"
                                : ""
                            }`}
                            onClick={() => isClickable && handleDayClick(currentDay)}
                            title={
                              isToday
                                ? "วันนี้"
                                : isDayOff
                                ? "วันหยุด"
                                : attendanceStatus === true
                                ? "มาเรียน (คลิกเพื่อเปลี่ยนเป็นขาดเรียน)"
                                : attendanceStatus === false
                                ? "ขาดเรียน (คลิกเพื่อยกเลิก)"
                                : "คลิกเพื่อเช็กชื่อ"
                            }
                          >
                            <div className="flex items-center justify-between w-full">
                              <span
                                className={`text-[12px] ${
                                  isToday ? "font-bold text-pink-600" : ""
                                }`}
                              >
                                {cell.dateNumber}
                              </span>
                              {isToday && (
                                <span className="text-[8px] font-bold bg-pink-500 text-white px-1 py-0.2 rounded-sm shadow-2xs leading-tight">
                                  วันนี้
                                </span>
                              )}
                            </div>

                            {/* Small Status indicator text if marked */}
                            <div className="text-[9px] leading-none self-end">
                              {attendanceStatus === true && (
                                <span className="text-white/90">มา</span>
                              )}
                              {attendanceStatus === false && (
                                <span className="text-white font-bold">ขาด</span>
                              )}
                              {isDayOff && (
                                <span className="text-violet-600/75 text-[8px]">
                                  หยุด
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* View Week Button */}
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="h-12 flex items-center justify-center rounded-xl bg-pink-50/60 border border-pink-200/60 text-xs font-semibold text-pink-500 hover:text-pink-600 hover:bg-pink-100/70 cursor-pointer transition-all active:scale-95 shadow-2xs"
                        title="ดูตารางเรียนสัปดาห์นี้"
                      >
                        View
                      </button>
                    </React.Fragment>
                  ));
                })()}
              </div>

              {/* Legend Helper */}
              <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full ring-2 ring-pink-500 bg-white" />
                  <span>วันนี้</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>มาเรียน</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span>ขาดเรียน</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-200" />
                  <span>วันหยุด</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timetable Modal Overlay */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 relative flex flex-col gap-4 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Title */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  ตารางเรียนห้อง {roomId}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  กดที่คาบเรียนเพื่อบันทึกสถานะการเข้าเรียน
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-2xl font-bold leading-none p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Timetable Content */}
            <div className="py-2">
              <Timetable roomId={roomId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
