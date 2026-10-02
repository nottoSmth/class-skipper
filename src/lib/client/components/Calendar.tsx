"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaAngleLeft, FaAngleRight } from "react-icons/fa";

import { useFirebaseContext } from "@/lib/client/context/firebaseContext";

import { singletonFirestorePublic } from "@/lib/client/singleton/client.firebasePublic";
import { singletonFirestore } from "@/lib/client/singleton/client.firebaseAuth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Timetable from "@/lib/client/components/Timetable";
import {
  emptyAttendance,
  setFullDay,
  isDayFullyAttended,
  isDayPartiallyAttended,
  togglePeriod,
} from "@/lib/shared/attendanceCodec";
import { handleClientLogout } from "@/lib/client/auth";

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

type Day = {
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

function isSameDay(d1: Day, d2: Day): boolean {
  return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
}

function monthKey(d: Day): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}`;
}

const EMPTY_RECORDS: DayData[] = [];
const EMPTY_ATTENDANCE_STR = emptyAttendance();

const MonthCard = React.memo(
  ({
    monthIdx,
    month,
    isCurrentMonth,
    attendance,
    records,
    attendanceLoading,
    onDayClick,
    onViewWeek,
    assignRef,
  }: {
    monthIdx: number;
    month: Day;
    isCurrentMonth: boolean;
    attendance: string;
    records: DayData[];
    attendanceLoading: boolean;
    onDayClick: (
      date: Day,
      currentRecords: DayData[],
      currentAttendance: string,
    ) => void;
    onViewWeek: (weekDayNumbers: number[]) => void;
    assignRef: (idx: number, el: HTMLDivElement | null) => void;
  }) => {
    const firstDow = new Date(month.year, month.month - 1, 1).getDay();
    const daysInMonth = new Date(month.year, month.month, 0).getDate();
    const daysInPrevMonth = new Date(month.year, month.month - 1, 0).getDate();

    const cells = Array.from({ length: 42 }).map((_, i) => {
      const dateNum = i - firstDow + 1;
      if (dateNum < 1)
        return { dateNumber: daysInPrevMonth + dateNum, isInThisMonth: false };
      if (dateNum > daysInMonth)
        return { dateNumber: dateNum - daysInMonth, isInThisMonth: false };
      return { dateNumber: dateNum, isInThisMonth: true };
    });

    return (
      <div
        ref={(el) => assignRef(monthIdx, el)}
        className="snap-start shrink-0 w-full min-w-xl snap-center"
      >
        <div className="flex mb-2 gap-1 items-end">
          <div className="text-4xl mb-2">{MONTH_NAMES[month.month - 1]}</div>
          <div className="text-lg">{month.year}</div>
          {isCurrentMonth && attendanceLoading && (
            <div className="text-xs text-slate-400 ml-2 mb-3 animate-pulse">
              loading...
            </div>
          )}
        </div>

        <div className="grid grid-cols-8 gap-1 mb-1">
          {DAY_LABELS.map((label, idx) => (
            <div
              key={idx}
              className={`px-2 rounded bg-slate-300 text-center ${label === "Sun" ? "text-red-500" : label === "Sat" ? "text-violet-800" : ""}`}
            >
              {label}
            </div>
          ))}
          <div className="px-2 rounded bg-slate-300 text-slate-500 font-semibold text-center text-xs flex items-center justify-center">
            Week
          </div>
        </div>

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
                        className={`h-12 px-2 py-1 rounded bg-slate-100 ${isSunday ? "text-red-300" : "text-slate-400"}`}
                      >
                        {cell.dateNumber}
                      </div>
                    );
                  }

                  const currentDay: Day = {
                    year: month.year,
                    month: month.month,
                    day: cell.dateNumber,
                  };
                  const record = records.find((r) =>
                    isSameDay(r.day, currentDay),
                  );
                  const isClickable =
                    !record?.isDayOff && !isSunday && !isSaturday;

                  const fullyAttended =
                    isCurrentMonth &&
                    isDayFullyAttended(attendance, cell.dateNumber);
                  const partiallyAttended =
                    isCurrentMonth &&
                    !fullyAttended &&
                    isDayPartiallyAttended(attendance, cell.dateNumber);

                  let cellClass: string;
                  if (record?.isDayOff)
                    cellClass = "bg-violet-200 text-slate-400";
                  else if (fullyAttended)
                    cellClass = "bg-emerald-400 text-white";
                  else if (partiallyAttended)
                    cellClass = "bg-amber-400 text-white";
                  else
                    cellClass = `bg-slate-200 ${isSunday ? "text-red-400" : isSaturday ? "text-violet-800" : "text-black"}`;

                  return (
                    <div
                      key={globalIdx}
                      className={`h-12 px-2 py-1 rounded ${cellClass} ${isClickable ? "cursor-pointer select-none transition-all hover:brightness-95 active:scale-95" : ""}`}
                      onClick={() =>
                        isClickable &&
                        onDayClick(currentDay, records, attendance)
                      }
                    >
                      {cell.dateNumber}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    const dayNums = weekCells
                      .filter((c) => c.isInThisMonth)
                      .map((c) => c.dateNumber);
                    onViewWeek(dayNums);
                  }}
                  className="h-12 flex items-center justify-center rounded bg-slate-50 border border-slate-200 text-xs font-semibold text-pink-500 hover:text-pink-600 hover:bg-pink-50/50 cursor-pointer transition-all active:scale-95"
                >
                  View
                </button>
              </React.Fragment>
            ));
          })()}
        </div>
      </div>
    );
  },
);

export default function Calendar() {
  const [records, setRecords] = useState<DayData[]>([]);
  const [nowMonth, setNowMonth] = useState<Day>({ day: 0, month: 0, year: 0 });

  // --- Attendance state (base64 per month) ---
  const [attendance, setAttendance] = useState<string>(emptyAttendance());
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // --- Modal state ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalWeekDays, setModalWeekDays] = useState<number[]>([]);

  // Lock body scroll when modal open
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

  // --- Get username from localStorage ---
  const getUsername = (): string | null => {
    try {
      const stored = localStorage.getItem("userData");
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed.username || null;
    } catch {
      return null;
    }
  };

  // --- Save attendance directly to Firestore ---
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveAttendance = useCallback((newData: string, date: Day) => {
    if (!date.year || !date.month) return;
    const username = getUsername();
    if (!username) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const currentMonthKey = monthKey(date);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const docRef = doc(
          singletonFirestore,
          "users",
          username,
          "attendance",
          currentMonthKey,
        );
        await setDoc(
          docRef,
          { data: newData, updatedAt: Date.now() },
          { merge: true },
        );
      } catch (err: unknown) {
        console.error("Failed to save attendance:", err);
        const errorCode = (err as { code?: string })?.code;
        if (errorCode === "permission-denied" || errorCode === "unauthenticated") {
          await handleClientLogout("/login");
        }
      }
    }, 1500);
  }, []);

  // --- Load attendance from Firestore when month changes ---

  const { isFirebaseReady } = useFirebaseContext();
  useEffect(() => {
    if (!isFirebaseReady) return;
    if (!nowMonth.year || !nowMonth.month) return;
    const username = getUsername();
    if (!username) return;
    let cancelled = false;

    async function loadAttendance() {
      setAttendanceLoading(true);
      try {
        const docRef = doc(
          singletonFirestore,
          "users",
          username!,
          "attendance",
          monthKey(nowMonth),
        );
        const snap = await getDoc(docRef);
        if (!cancelled) {
          const data = snap.exists() ? snap.data()?.data : null;
          setAttendance(data || emptyAttendance());
        }
      } catch (err: unknown) {
        console.error("Failed to load attendance:", err);
        const errorCode = (err as { code?: string })?.code;
        if (errorCode === "permission-denied" || errorCode === "unauthenticated") {
          await handleClientLogout("/login");
          return;
        }
        if (!cancelled) setAttendance(emptyAttendance());
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    }

    loadAttendance();
    return () => {
      cancelled = true;
    };
  }, [nowMonth, isFirebaseReady]);

  // --- Load day-off data ---
  useEffect(() => {
    async function fetchDayOff(monthString: string) {
      try {
        const ref = doc(
          singletonFirestorePublic,
          "calendar",
          "properties",
          "day-off",
          monthString,
        );
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          console.warn("No data found");
          return;
        }

        const data = snap.data();
        const binNumber = data?.bin ?? 0;

        const bin: boolean[] = Array.from(
          { length: 31 },
          (_, i) => ((binNumber >> i) & 1) === 1,
        );
        const mapped: DayData[] = bin
          .map((isOff, i) => ({
            day: {
              year: nowMonth.year,
              month: nowMonth.month,
              day: i + 1,
            },
            isDayOff: isOff,
            isAttened: false,
            isHaveNote: false,
          }))
          .filter((r) => r.isDayOff);
        setRecords(mapped);
      } catch (err) {
        console.error(err);
      }
    }

    fetchDayOff(`${nowMonth.year}-${String(nowMonth.month).padStart(2, "0")}`);
  }, [nowMonth]);

  // --- Month carousel state ---
  const [allMonths, setAllMonths] = useState<Day[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchCalendarRange() {
      const snap = await getDoc(
        doc(singletonFirestorePublic, "calendar", "properties"),
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
      while (
        y < endCalendar.year ||
        (y === endCalendar.year && m <= endCalendar.month)
      ) {
        result.push({ year: y, month: m, day: 1 });
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
      setAllMonths(result);
    }
    fetchCalendarRange();
  }, []);

  const scroll = (dir: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir * scrollRef.current.clientWidth,
      behavior: "smooth",
    });
  };

  // --- Day click → mark entire day attended (all 8 periods) ---
  // --- Day click → mark entire day attended (all 8 periods) ---
  const handleDayClick = useCallback(
    (date: Day, currentRecords: DayData[], currentAttendance: string) => {
      const record = currentRecords.find((r) => isSameDay(r.day, date));
      const dow = new Date(date.year, date.month - 1, date.day).getDay();
      if (record?.isDayOff || dow === 0 || dow === 6) return;

      const fullyAttended = isDayFullyAttended(currentAttendance, date.day);
      const newAttendance = setFullDay(
        currentAttendance,
        date.day,
        !fullyAttended,
      );
      setAttendance(newAttendance);
      saveAttendance(newAttendance, date);
    },
    [saveAttendance],
  );

  // --- Period toggle (called from Timetable modal) ---
  const handleTogglePeriod = useCallback(
    (dayOfMonth: number, period: number) => {
      setAttendance((prev) => {
        const newAttendance = togglePeriod(prev, dayOfMonth, period);
        saveAttendance(newAttendance, nowMonth);
        return newAttendance;
      });
    },
    [saveAttendance, nowMonth],
  );

  // --- Open modal with week context ---
  const openWeekModal = useCallback((weekDayNumbers: number[]) => {
    setModalWeekDays(weekDayNumbers);
    setIsModalOpen(true);
  }, []);

  const assignRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    monthRefs.current[idx] = el;
  }, []);

  // --- Intersection observer for month scroll ---
  const monthRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (allMonths.length === 0) return;

    const observers: IntersectionObserver[] = [];

    monthRefs.current.forEach((el, idx) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const { year, month } = allMonths[idx];
            setNowMonth({ year: year, month: month, day: nowMonth.day });
          }
        },
        {
          root: scrollRef.current,
          threshold: 0.1,
        },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, [allMonths]);

  return (
    <div className="max-w-xl mx-auto relative flex items-center justify-center">
      <div className="absolute top-0 right-0 flex gap-2 z-10">
        <button
          onClick={() => scroll(-1)}
          className="p-2 rounded bg-slate-200 hover:bg-slate-300 hover:cursor-pointer"
        >
          <FaAngleLeft size={18} />
        </button>
        <button
          onClick={() => scroll(1)}
          className="p-2 rounded bg-slate-200 hover:bg-slate-300 hover:cursor-pointer"
        >
          <FaAngleRight size={18} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex w-xl gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
      >
        {allMonths.map((month, monthIdx) => {
          const isCurrentMonth =
            month.year === nowMonth.year && month.month === nowMonth.month;
          return (
            <MonthCard
              key={monthIdx}
              monthIdx={monthIdx}
              month={month}
              isCurrentMonth={isCurrentMonth}
              attendance={isCurrentMonth ? attendance : EMPTY_ATTENDANCE_STR}
              records={isCurrentMonth ? records : EMPTY_RECORDS}
              attendanceLoading={attendanceLoading}
              onDayClick={handleDayClick}
              onViewWeek={openWeekModal}
              assignRef={assignRef}
            />
          );
        })}
      </div>

      {/* Timetable Modal Overlay */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 relative flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Title */}
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-xl font-bold text-slate-800">
                Weekly Timetable View
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-2xl font-bold leading-none p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>
            {/* Content */}
            <div className="py-2">
              <Timetable
                attendance={attendance}
                onTogglePeriod={handleTogglePeriod}
                weekDays={modalWeekDays}
                month={nowMonth.month}
                year={nowMonth.year}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
