"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { singletonFirestorePublic } from "@/lib/client/singleton/client.firebasePublic";
import {
  formatDateKey,
  getPeriodKey,
  getAttendanceMap,
  subscribeToAttendance,
  parseCalendarPropertyDateKey,
  parseDateString,
  formatThaiDateRange,
} from "@/lib/client/attendanceStorage";
import {
  FaUserTie,
  FaExclamationTriangle,
  FaCheckCircle,
  FaCalendarCheck,
  FaTimesCircle,
} from "react-icons/fa";

interface SubjectItem {
  id: string; // e.g. "ก67676"
  subject: string; // e.g. "วิชาจีบสาว"
  teacher: string; // e.g. "เจ้ปูนสุดสวย"
  periods: { dayId: number; periodIndex: number }[]; // days (1=Mon, ..., 5=Fri)
}

interface AbsenceCalculatorProps {
  roomId?: string;
}

export default function AbsenceCalculator({ roomId = "67" }: AbsenceCalculatorProps) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [dayOffMap, setDayOffMap] = useState<Record<string, boolean>>({});
  const [semesterStart, setSemesterStart] = useState<string>("2026-10-15");
  const [semesterEnd, setSemesterEnd] = useState<string>("2027-02-01");

  // Load and listen to shared attendance
  useEffect(() => {
    setAttendanceMap(getAttendanceMap());
    const unsubscribe = subscribeToAttendance(() => {
      setAttendanceMap(getAttendanceMap());
    });
    return () => unsubscribe();
  }, []);

  // Fetch timetable subjects and calendar range
  useEffect(() => {
    async function fetchSubjectsAndCalendar() {
      setLoading(true);
      try {
        // 1. Fetch calendar properties
        const calPropSnap = await getDoc(
          doc(singletonFirestorePublic, "calendar", "properties")
        );
        if (calPropSnap.exists()) {
          const calData = calPropSnap.data();
          if (calData["start-calendar"]) {
            setSemesterStart(
              parseCalendarPropertyDateKey(calData["start-calendar"], "2026-10-15")
            );
          }
          if (calData["end-calendar"]) {
            setSemesterEnd(
              parseCalendarPropertyDateKey(calData["end-calendar"], "2027-02-01", true)
            );
          }
        }

        // Fetch day-offs
        const dayOffSnap = await getDocs(
          collection(singletonFirestorePublic, "calendar", "properties", "day-off")
        );
        const dayOffs: Record<string, boolean> = {};
        dayOffSnap.docs.forEach((docSnap) => {
          const monthKey = docSnap.id;
          const binNumber = docSnap.data()?.bin ?? 0;
          for (let day = 1; day <= 31; day++) {
            if (((binNumber >> (day - 1)) & 1) === 1) {
              const [y, m] = monthKey.split("-");
              dayOffs[formatDateKey(parseInt(y, 10), parseInt(m, 10), day)] = true;
            }
          }
        });
        setDayOffMap(dayOffs);

        // 2. Fetch timetable classes for room
        const subjectsMap: Record<string, SubjectItem> = {};
        for (let dayId = 1; dayId <= 5; dayId++) {
          const classRef = collection(
            singletonFirestorePublic,
            `rooms/${roomId}/table/${dayId}/class`
          );
          const classSnap = await getDocs(classRef);
          classSnap.docs.forEach((d) => {
            const data = d.data();
            const periodIndex = parseInt(d.id, 10);
            const key = data.subject || data.id || `Subject-${dayId}-${periodIndex}`;

            if (!subjectsMap[key]) {
              subjectsMap[key] = {
                id: data.id || "รหัสวิชา",
                subject: data.subject || "ไม่ระบุชื่อวิชา",
                teacher: data.teacher || "ไม่ระบุผู้สอน",
                periods: [],
              };
            }
            subjectsMap[key].periods.push({ dayId, periodIndex });
          });
        }

        setSubjects(Object.values(subjectsMap));
      } catch (err) {
        console.error("Error fetching absence calculator data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSubjectsAndCalendar();
  }, [roomId]);

  // Today reference
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const todayKey = useMemo(() => {
    const d = new Date();
    return formatDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, []);

  // Automatic calculation strictly from scheduled sessions and attendance records
  // "ส่วนจำนวนวันที่ลาได้ให้เช็คจากวันที่เข้าเท่านั้นโดยแก้เองเหมือนในรูปไม่ได้"
  const calculations = useMemo(() => {
    // Current semester window derived from Firebase start-calendar and end-calendar
    const termStart = parseDateString(semesterStart);
    const termEnd = parseDateString(semesterEnd);

    return subjects.map((subj) => {
      let totalSemesterHours = 0;
      let pastScheduledHours = 0;
      let totalAttended = 0;
      let totalMissed = 0;

      // Iterate through each date in the academic semester
      const cur = new Date(termStart);
      while (cur <= termEnd) {
        const dow = cur.getDay(); // 1 = Mon ... 5 = Fri
        const dateKey = formatDateKey(
          cur.getFullYear(),
          cur.getMonth() + 1,
          cur.getDate()
        );

        // Check if this is a school day and not a day-off
        if (dow >= 1 && dow <= 5 && !dayOffMap[dateKey]) {
          const scheduledPeriods = subj.periods.filter((p) => p.dayId === dow);

          if (scheduledPeriods.length > 0) {
            // Count total scheduled sessions across the semester
            totalSemesterHours += scheduledPeriods.length;

            // If date is in the past or today, evaluate attendance
            if (dateKey <= todayKey) {
              pastScheduledHours += scheduledPeriods.length;

              scheduledPeriods.forEach((sp) => {
                const pKey = getPeriodKey(dateKey, sp.periodIndex);
                const pVal = attendanceMap[pKey];

                if (pVal === true) {
                  // Checked as attended
                  totalAttended += 1;
                } else if (pVal === undefined && attendanceMap[dateKey] === true) {
                  // Day level checked as attended
                  totalAttended += 1;
                } else {
                  // Not attended (absent by default for past dates)
                  totalMissed += 1;
                }
              });
            }
          }
        }
        cur.setDate(cur.getDate() + 1);
      }

      // If timetable is empty or minimal, provide a minimum semester hours fallback
      const totalHours = totalSemesterHours > 0 ? totalSemesterHours : 20;

      // Max allowed absence quota: Standard 20% of total class hours (เกณฑ์เวลาเรียน 80%)
      // "จำนวนวันที่ลาได้ให้เช็คจากวันที่เข้าเท่านั้น"
      const maxAbsence = Math.max(1, Math.floor(totalHours * 0.20));

      const remainingQuota = maxAbsence - totalMissed;
      const percentageUsed = maxAbsence > 0 ? Math.min(100, Math.round((totalMissed / maxAbsence) * 100)) : 0;

      return {
        subject: subj,
        totalMissed,
        totalAttended,
        totalHours,
        maxAbsence,
        remainingQuota,
        percentageUsed,
      };
    });
  }, [subjects, attendanceMap, dayOffMap, todayKey, semesterStart, semesterEnd]);

  const todayFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-xl p-6 bg-white/80 rounded-2xl shadow-sm border border-pink-100 flex items-center justify-center text-slate-400">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500 mr-3"></div>
        กำลังคำนวณข้อมูลวิชาที่ขาดจากตารางเรียน...
      </div>
    );
  }

  if (subjects.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4">
      {/* Header Container */}
      <div className="bg-linear-to-r from-pink-500 to-rose-400 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <FaCalendarCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">คำนวณวิชาที่ขาดเรียน</h2>
              <p className="text-xs text-pink-100 mt-0.5">
                ภาคเรียน: {formatThaiDateRange(semesterStart, semesterEnd)} • คำนวณถึงปัจจุบัน ({todayFormatted})
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-white/25 rounded-full backdrop-blur-xs">
            ห้อง {roomId}
          </span>
        </div>
      </div>

      {/* Subject Cards */}
      <div className="flex flex-col gap-3">
        {calculations.map(
          ({
            subject,
            totalMissed,
            totalAttended,
            totalHours,
            maxAbsence,
            remainingQuota,
            percentageUsed,
          }) => {
            const isOverQuota = totalMissed > maxAbsence;
            const isAtQuota = totalMissed === maxAbsence;
            const isWarning = totalMissed >= Math.ceil(maxAbsence * 0.75) && !isAtQuota && !isOverQuota;

            return (
              <div
                key={subject.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col gap-3.5 relative overflow-hidden"
              >
                {/* Status indicator bar on left */}
                <div
                  className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                    isOverQuota
                      ? "bg-rose-500"
                      : isAtQuota
                      ? "bg-amber-500"
                      : isWarning
                      ? "bg-orange-400"
                      : "bg-emerald-400"
                  }`}
                />

                {/* Top Row: Subject Name, ID, Teacher */}
                <div className="flex items-start justify-between gap-2 pl-1">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-base">
                        {subject.subject}
                      </span>
                      <span className="text-xs font-mono font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        {subject.id}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <FaUserTie className="text-pink-400" size={11} />
                      <span>โดย {subject.teacher}</span>
                    </div>
                  </div>
                </div>

                {/* EXACT SPECIFICATION REQUIREMENT DISPLAY:
                    "วิชาจีบสาว จส676767 โดยครูพี่ปูน ขาด 2/4 จากทั้งหมด 67ชั่วโมงเรียน"
                    "(เลขแรกคือเลขที่ขาด เลขสองคือขาดได้ทั้งหมด) ตอนคำนวนวันขาด ให้คำนวนถึง ปัจจุบัน" */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col gap-1.5">
                  <div className="text-sm font-semibold text-slate-700 leading-snug">
                    <span className="text-slate-900 font-bold">{subject.subject}</span>{" "}
                    <span className="font-mono text-slate-600">{subject.id}</span>{" "}
                    <span>โดย {subject.teacher}</span>{" "}
                    <span className="inline-block mt-1 sm:mt-0 font-bold text-pink-600">
                      ขาด {totalMissed}/{maxAbsence} จากทั้งหมด {totalHours}ชั่วโมงเรียน
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    *(เลขแรกคือเลขที่ขาด เลขสองคือขาดได้ทั้งหมด) คำนวณอัตโนมัติจากวันเข้าเรียนถึงปัจจุบัน
                  </div>
                </div>

                {/* Attendance Summary Chips */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                    <div className="text-[10px] text-emerald-600 font-medium">เข้าเรียนแล้ว</div>
                    <div className="font-extrabold text-emerald-700 text-sm mt-0.5">{totalAttended} คาบ</div>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-2 border border-rose-100">
                    <div className="text-[10px] text-rose-600 font-medium">ขาดเรียน</div>
                    <div className="font-extrabold text-rose-700 text-sm mt-0.5">{totalMissed} คาบ</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-2 border border-blue-100">
                    <div className="text-[10px] text-blue-600 font-medium">เรียนทั้งหมด</div>
                    <div className="font-extrabold text-blue-700 text-sm mt-0.5">{totalHours} คาบ</div>
                  </div>
                  <div className={`rounded-xl p-2 border ${
                    remainingQuota <= 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="text-[10px] text-slate-500 font-medium">ยังลาได้อีก</div>
                    <div className={`font-extrabold text-sm mt-0.5 ${
                      remainingQuota <= 0 ? "text-red-600" : "text-slate-800"
                    }`}>
                      {remainingQuota > 0 ? remainingQuota : 0} คาบ
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Status Badge */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">
                      ใช้โควตาขาดเรียนไปแล้ว:{" "}
                      <span className="font-semibold text-slate-700">
                        {percentageUsed}%
                      </span>
                    </span>

                    {/* Status Badges */}
                    {isOverQuota ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[11px] text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                        <FaTimesCircle size={11} /> ขาดเกินโควตา (มส.)
                      </span>
                    ) : isAtQuota ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        <FaExclamationTriangle size={11} /> ครบโควตาแล้ว (ห้ามขาดอีก)
                      </span>
                    ) : isWarning ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                        <FaExclamationTriangle size={11} /> เสี่ยง (เหลืออีก {remainingQuota} ครั้ง)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <FaCheckCircle size={11} /> ปลอดภัย (เหลืออีก {remainingQuota} ครั้ง)
                      </span>
                    )}
                  </div>

                  {/* Progress track */}
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOverQuota
                          ? "bg-rose-500"
                          : isAtQuota
                          ? "bg-amber-500"
                          : isWarning
                          ? "bg-orange-400"
                          : "bg-emerald-400"
                      }`}
                      style={{ width: `${Math.min(100, (totalMissed / maxAbsence) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
