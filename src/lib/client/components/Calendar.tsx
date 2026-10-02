"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { FaAngleLeft, FaAngleRight, FaCalendarDay } from "react-icons/fa";
import { singletonFirestorePublic } from "@/lib/client/singleton/client.firebasePublic";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import Timetable, { WeekDayInfo } from "@/lib/client/components/Timetable";
import {
  formatDateKey,
  getPeriodKey,
  getAttendanceMap,
  saveAttendanceMap,
  subscribeToAttendance,
  getDayAttendanceStatus,
  DayStatus,
  parseCalendarPropertyDate,
  parseCalendarPropertyDateKey,
} from "@/lib/client/attendanceStorage";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const THAI_MONTH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

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

interface CalendarCell {
  dateNumber: number;
  year: number;
  month: number;
  day: number;
  dateKey: string;
  isInThisMonth: boolean;
  dayOfWeek: number; // 0 = Sun ... 6 = Sat
}

interface CalendarProps {
  roomId?: string;
}

export default function Calendar({ roomId = "67" }: CalendarProps) {
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [dayOffCache, setDayOffCache] = useState<Record<string, boolean[]>>({});
  const [scheduledPeriodsByDay, setScheduledPeriodsByDay] = useState<Record<number, number[]>>({});
  const [nowMonth, setNowMonth] = useState<Day>({ day: 0, month: 0, year: 0 });
  const [allMonths, setAllMonths] = useState<Day[]>([]);

  // Modal State for isolated weekly timetable
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<{
    label: string;
    days: WeekDayInfo[];
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasAutoScrolled = useRef(false);

  // Today reference
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDayNum = today.getDate();
  const todayKey = useMemo(() => {
    return formatDateKey(currentYear, currentMonth, currentDayNum);
  }, [currentYear, currentMonth, currentDayNum]);

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

  // 2. Load and subscribe to shared attendance state
  useEffect(() => {
    setAttendanceMap(getAttendanceMap());
    const unsub = subscribeToAttendance(() => {
      setAttendanceMap(getAttendanceMap());
    });
    return () => unsub();
  }, []);

  // 3. Fetch scheduled periods for the room to evaluate days' completion
  useEffect(() => {
    async function fetchScheduledPeriods() {
      try {
        const periodMap: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        for (let dayId = 1; dayId <= 5; dayId++) {
          const classRef = collection(
            singletonFirestorePublic,
            `rooms/${roomId}/table/${dayId}/class`
          );
          const snap = await getDocs(classRef);
          snap.forEach((docSnap) => {
            const pId = parseInt(docSnap.id, 10);
            if (!isNaN(pId)) {
              periodMap[dayId].push(pId);
            }
          });
        }
        setScheduledPeriodsByDay(periodMap);
      } catch (err) {
        console.error("Error fetching room schedule:", err);
      }
    }
    fetchScheduledPeriods();
  }, [roomId]);

  // 4. Fetch calendar range (start/end months)
  useEffect(() => {
    async function fetchCalendarRange() {
      try {
        const snap = await getDoc(
          doc(singletonFirestorePublic, "calendar", "properties")
        );

        if (!snap.exists()) return;

        const data = snap.data();
        const startDate = parseCalendarPropertyDate(data["start-calendar"], new Date());
        const endDate = parseCalendarPropertyDate(data["end-calendar"], new Date(), true);

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

  // 5. On page reload, auto-scroll to current month
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

    const timer = setTimeout(() => {
      const el = monthRefs.current[idx];
      if (el && scrollRef.current) {
        el.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
        hasAutoScrolled.current = true;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [allMonths, currentYear, currentMonth, currentDayNum]);

  // 6. Fetch day-offs for visible month
  useEffect(() => {
    if (!nowMonth.year || !nowMonth.month) return;

    const monthKey = `${nowMonth.year}-${String(nowMonth.month).padStart(2, "0")}`;
    if (dayOffCache[monthKey]) return;

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

  // 7. Month carousel intersection observer
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

  // Carousel scroll helpers
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

  // Open weekly isolated timetable modal
  const handleViewWeek = (weekCells: CalendarCell[]) => {
    // School days are Monday (idx 1) to Friday (idx 5)
    const schoolDays: WeekDayInfo[] = weekCells.slice(1, 6).map((c) => ({
      year: c.year,
      month: c.month,
      day: c.day,
      dateKey: c.dateKey,
      dayOfWeek: c.dayOfWeek,
    }));

    const firstDay = schoolDays[0];
    const lastDay = schoolDays[schoolDays.length - 1];
    const weekLabel = `สัปดาห์ที่ ${firstDay.day} ${THAI_MONTH_SHORT[firstDay.month - 1]} - ${lastDay.day} ${THAI_MONTH_SHORT[lastDay.month - 1]} ${lastDay.year}`;

    setSelectedWeek({
      label: weekLabel,
      days: schoolDays,
    });
    setIsModalOpen(true);
  };

  // Click on a past/today school day: only 2 states (มา <-> ขาด)
  const handleDayClick = (cell: CalendarCell) => {
    // Future dates cannot be toggled into attendance
    if (cell.dateKey > todayKey) return;

    // Weekends and day-offs are non-school days
    if (cell.dayOfWeek === 0 || cell.dayOfWeek === 6) return;
    const monthKey = `${cell.year}-${String(cell.month).padStart(2, "0")}`;
    if (dayOffCache[monthKey]?.[cell.day - 1]) return;

    const scheduled = scheduledPeriodsByDay[cell.dayOfWeek] || [];
    const currentStatus = getDayAttendanceStatus(
      cell.dateKey,
      cell.dayOfWeek,
      scheduled,
      attendanceMap,
      false,
      todayKey
    );

    // Only 2 states: If currently attended -> switch to absent. If absent or partial -> switch to attended.
    const willBeAttended = currentStatus !== "attended";

    const nextMap = { ...attendanceMap, [cell.dateKey]: willBeAttended };
    // Also toggle all scheduled periods of this day so they stay in sync
    scheduled.forEach((p) => {
      const pKey = getPeriodKey(cell.dateKey, p);
      nextMap[pKey] = willBeAttended;
    });

    setAttendanceMap(nextMap);
    saveAttendanceMap(nextMap);
  };

  return (
    <div className="max-w-xl mx-auto relative flex flex-col items-center justify-center">
      {/* Top Toolbar */}
      <div className="w-full flex justify-between items-center mb-3 px-1">
        <button
          type="button"
          onClick={scrollToCurrentMonth}
          className="px-3 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-600 font-semibold text-xs border border-pink-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
          title="เลื่อนไปยังเดือนปัจจุบัน"
        >
          <FaCalendarDay size={12} />
          <span>เดือนปัจจุบัน</span>
        </button>

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

          // Calculate all 42 cells with precise date coordinates
          const cells: CalendarCell[] = Array.from({ length: 42 }).map((_, i) => {
            const dateNum = i - firstDow + 1;
            const dayOfWeek = i % 7;

            if (dateNum < 1) {
              const prevMonth = month.month === 1 ? 12 : month.month - 1;
              const prevYear = month.month === 1 ? month.year - 1 : month.year;
              const d = daysInPrevMonth + dateNum;
              return {
                dateNumber: d,
                year: prevYear,
                month: prevMonth,
                day: d,
                dateKey: formatDateKey(prevYear, prevMonth, d),
                isInThisMonth: false,
                dayOfWeek,
              };
            }
            if (dateNum > daysInMonth) {
              const nextMonth = month.month === 12 ? 1 : month.month + 1;
              const nextYear = month.month === 12 ? month.year + 1 : month.year;
              const d = dateNum - daysInMonth;
              return {
                dateNumber: d,
                year: nextYear,
                month: nextMonth,
                day: d,
                dateKey: formatDateKey(nextYear, nextMonth, d),
                isInThisMonth: false,
                dayOfWeek,
              };
            }
            return {
              dateNumber: dateNum,
              year: month.year,
              month: month.month,
              day: dateNum,
              dateKey: formatDateKey(month.year, month.month, dateNum),
              isInThisMonth: true,
              dayOfWeek,
            };
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
                    className={`py-1.5 rounded-lg text-center text-xs font-semibold ${label === "Sun"
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
                        const isSunday = cell.dayOfWeek === 0;
                        const isSaturday = cell.dayOfWeek === 6;

                        const isDayOff = !!dayOffCache[monthKey]?.[cell.day - 1];
                        const scheduled = scheduledPeriodsByDay[cell.dayOfWeek] || [];

                        // Compute state (future, attended, partial, absent, dayOff, weekend)
                        const status: DayStatus = getDayAttendanceStatus(
                          cell.dateKey,
                          cell.dayOfWeek,
                          scheduled,
                          attendanceMap,
                          isDayOff,
                          todayKey
                        );

                        const isToday = cell.dateKey === todayKey;
                        const isPastOrToday = cell.dateKey <= todayKey;
                        const isSchoolDay = !isSunday && !isSaturday && !isDayOff;
                        const isClickable = isSchoolDay && isPastOrToday;

                        // Visual styling based on status
                        let cellClass: string;
                        let statusText: string | null = null;

                        if (!cell.isInThisMonth) {
                          // Day belongs to neighboring month
                          if (status === "attended") {
                            cellClass = "bg-emerald-300/60 text-white font-medium";
                            statusText = "มา";
                          } else if (status === "partial") {
                            cellClass = "bg-amber-300/70 text-white font-medium";
                            statusText = "ไม่ครบ";
                          } else if (status === "absent") {
                            cellClass = "bg-rose-300/60 text-white font-medium";
                            statusText = "ขาด";
                          } else {
                            cellClass = `bg-slate-50/50 ${isSunday ? "text-red-200" : "text-slate-300"}`;
                          }
                        } else {
                          // Day belongs to current month
                          if (status === "dayOff") {
                            cellClass = "bg-violet-100 text-violet-500/80";
                            statusText = "หยุด";
                          } else if (isSunday) {
                            cellClass = "bg-slate-50 text-red-500";
                          } else if (isSaturday) {
                            cellClass = "bg-slate-50 text-violet-800";
                          } else if (status === "future") {
                            // วันที่ยังมาไม่ถึงเป็นสีเทา
                            cellClass = "bg-slate-100 text-slate-400 border border-slate-200/50 hover:bg-slate-200/70";
                          } else if (status === "attended") {
                            // เข้าเรียนครบทุกคาบ (เขียว)
                            cellClass = "bg-emerald-400 text-white font-semibold shadow-xs";
                            statusText = "มา";
                          } else if (status === "partial") {
                            // เข้าไม่ครบทุกคาบ (เหลือง)
                            cellClass = "bg-amber-400 text-white font-semibold shadow-xs";
                            statusText = "ไม่ครบ";
                          } else {
                            // ขาดเรียน (สีแดง - Default ของวันที่ผ่านมาแล้ว)
                            cellClass = "bg-rose-400 text-white font-semibold shadow-xs";
                            statusText = "ขาด";
                          }
                        }

                        // Highlight วันนี้
                        const todayHighlightClass = isToday
                          ? "ring-2 ring-pink-500 ring-offset-2 ring-offset-white shadow-sm z-10"
                          : "";

                        return (
                          <div
                            key={globalIdx}
                            onClick={() => isClickable && handleDayClick(cell)}
                            className={`h-12 px-1.5 py-1 rounded-xl flex flex-col justify-between text-xs transition-all ${cellClass} ${todayHighlightClass} ${isClickable ? "cursor-pointer select-none active:scale-95" : ""
                              }`}
                            title={
                              isToday
                                ? "วันนี้"
                                : status === "future"
                                  ? "วันที่ยังมาไม่ถึง"
                                  : status === "attended"
                                    ? "มาเรียน (คลิกเพื่อเปลี่ยนเป็นขาด)"
                                    : status === "partial"
                                      ? "เข้าเรียนไม่ครบ (คลิกเพื่อเปลี่ยนเป็นมา หรือกด View เพื่อดูรายคาบ)"
                                      : status === "absent"
                                        ? "ขาดเรียน (คลิกเพื่อเปลี่ยนเป็นมา)"
                                        : undefined
                            }
                          >
                            <div className="flex items-center justify-between w-full">
                              <span
                                className={`text-[12px] ${isToday ? "font-bold text-pink-600" : ""
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

                            {/* Status Tag */}
                            {statusText && (
                              <div className="text-[9px] font-bold leading-none self-end">
                                <span>{statusText}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* View Week Button (Isolated weekly timetable) */}
                      <button
                        type="button"
                        onClick={() => handleViewWeek(weekCells)}
                        className="h-12 flex items-center justify-center rounded-xl bg-pink-50/60 border border-pink-200/60 text-xs font-semibold text-pink-500 hover:text-pink-600 hover:bg-pink-100/70 cursor-pointer transition-all active:scale-95 shadow-2xs"
                        title="ดูตารางเรียนประจำสัปดาห์นี้"
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
                  <span>มาเรียน (ครบ)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>เข้าไม่ครบ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span>ขาดเรียน (Default)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300" />
                  <span>ยังไม่ถึง</span>
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
      {isModalOpen && selectedWeek && (
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
                  {selectedWeek.label} • คลิกที่คาบเรียนเพื่อบันทึกสถานะ (มา / ขาด)
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

            {/* Timetable Content isolated for this specific week */}
            <div className="py-2">
              <Timetable
                roomId={roomId}
                weekDays={selectedWeek.days}
                weekLabel={selectedWeek.label}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
