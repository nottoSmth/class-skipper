"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { singletonFirestorePublic } from "@/lib/client/singleton/client.firebasePublic";
import {
  formatDateKey,
  getAttendanceMap,
  saveAttendanceMap,
  getSubjectConfigs,
  saveSubjectConfigs,
  subscribeToAttendance,
  SubjectConfig,
} from "@/lib/client/attendanceStorage";
import {
  FaBook,
  FaUserTie,
  FaExclamationTriangle,
  FaCheckCircle,
  FaPlus,
  FaMinus,
  FaCog,
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
  const [subjectConfigs, setSubjectConfigsState] = useState<Record<string, SubjectConfig>>({});
  const [dayOffMap, setDayOffMap] = useState<Record<string, boolean>>({});
  const [semesterStart, setSemesterStart] = useState<string>("2026-01-01");
  const [editingSubject, setEditingSubject] = useState<string | null>(null);

  // Load and listen to local attendance & configs
  useEffect(() => {
    setAttendanceMap(getAttendanceMap());
    setSubjectConfigsState(getSubjectConfigs());

    const unsubscribe = subscribeToAttendance(() => {
      setAttendanceMap(getAttendanceMap());
      setSubjectConfigsState(getSubjectConfigs());
    });
    return () => unsubscribe();
  }, []);

  // Fetch timetable subjects for room
  useEffect(() => {
    async function fetchSubjectsAndCalendar() {
      setLoading(true);
      try {
        // 1. Fetch calendar properties (start date & day-offs)
        const calPropSnap = await getDoc(
          doc(singletonFirestorePublic, "calendar", "properties")
        );
        if (calPropSnap.exists()) {
          const calData = calPropSnap.data();
          if (calData["start-calendar"]) {
            setSemesterStart(`${calData["start-calendar"]}-01`);
          }
        }

        // Fetch day-offs
        const dayOffSnap = await getDocs(
          collection(singletonFirestorePublic, "calendar", "properties", "day-off")
        );
        const dayOffs: Record<string, boolean> = {};
        dayOffSnap.docs.forEach((docSnap) => {
          const monthKey = docSnap.id; // e.g. "2026-01"
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
          const classSnap = await getDocs(
            collection(singletonFirestorePublic, `rooms/${roomId}/table/${dayId}/class`)
          );
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

  // Calculate missed classes up to TODAY
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const calculations = useMemo(() => {
    const startDate = new Date(semesterStart);
    // Find all dates from semester start up to today
    const pastDates: { date: Date; dateKey: string; dayOfWeek: number }[] = [];
    const cur = new Date(startDate);

    while (cur <= today) {
      const dow = cur.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
      const dateKey = formatDateKey(
        cur.getFullYear(),
        cur.getMonth() + 1,
        cur.getDate()
      );

      // Only weekdays (1-5) and non-holidays
      if (dow >= 1 && dow <= 5 && !dayOffMap[dateKey]) {
        pastDates.push({ date: new Date(cur), dateKey, dayOfWeek: dow });
      }
      cur.setDate(cur.getDate() + 1);
    }

    return subjects.map((subj) => {
      const cfg = subjectConfigs[subj.id] || {
        totalHours: 67, // Default 67 hours as requested in the example!
        maxAbsence: 4, // Default 4 allowed absences as requested in example!
        manualAbsences: 0,
      };

      // 1. Calculate absences from marked calendar dates up to today
      let calendarAbsenceCount = 0;
      pastDates.forEach(({ dateKey, dayOfWeek }) => {
        // If this subject is taught on this day of week
        const scheduledPeriods = subj.periods.filter((p) => p.dayId === dayOfWeek);
        if (scheduledPeriods.length > 0) {
          // If the day is marked as Absent (false) in attendanceMap
          if (attendanceMap[dateKey] === false) {
            calendarAbsenceCount += scheduledPeriods.length;
          }
        }
      });

      const totalMissed = Math.max(0, calendarAbsenceCount + (cfg.manualAbsences || 0));
      const totalHours = cfg.totalHours || 67;
      const maxAbsence = cfg.maxAbsence || 4;
      const remainingQuota = maxAbsence - totalMissed;
      const percentageUsed = Math.min(100, Math.round((totalMissed / maxAbsence) * 100));

      return {
        subject: subj,
        config: cfg,
        totalMissed,
        totalHours,
        maxAbsence,
        remainingQuota,
        percentageUsed,
        calendarAbsenceCount,
      };
    });
  }, [subjects, subjectConfigs, attendanceMap, dayOffMap, semesterStart, today]);

  // Handler to adjust manual absences
  const handleAdjustAbsence = (subjectId: string, delta: number) => {
    const current = subjectConfigs[subjectId] || {
      totalHours: 67,
      maxAbsence: 4,
      manualAbsences: 0,
    };
    const nextManual = Math.max(0, (current.manualAbsences || 0) + delta);
    const updated = {
      ...subjectConfigs,
      [subjectId]: {
        ...current,
        manualAbsences: nextManual,
      },
    };
    setSubjectConfigsState(updated);
    saveSubjectConfigs(updated);
  };

  // Handler to update config (total hours & max absence)
  const handleSaveConfig = (
    subjectId: string,
    newTotalHours: number,
    newMaxAbsence: number
  ) => {
    const current = subjectConfigs[subjectId] || {
      totalHours: 67,
      maxAbsence: 4,
      manualAbsences: 0,
    };
    const updated = {
      ...subjectConfigs,
      [subjectId]: {
        ...current,
        totalHours: Math.max(1, newTotalHours),
        maxAbsence: Math.max(1, newMaxAbsence),
      },
    };
    setSubjectConfigsState(updated);
    saveSubjectConfigs(updated);
    setEditingSubject(null);
  };

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
        กำลังคำนวณข้อมูลวิชาที่ขาด...
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
                คำนวณเวลาเรียนถึงปัจจุบัน ({todayFormatted})
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
            config,
            totalMissed,
            totalHours,
            maxAbsence,
            remainingQuota,
            percentageUsed,
          }) => {
            const isEditing = editingSubject === subject.id;
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

                  {/* Settings Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setEditingSubject(isEditing ? null : subject.id)
                    }
                    title="แก้ไขโควตาและชั่วโมงเรียน"
                    className="p-1.5 text-slate-400 hover:text-pink-500 hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <FaCog size={15} />
                  </button>
                </div>

                {/* Edit Config Form (Collapsible) */}
                {isEditing && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const hours = parseInt(
                        (form.elements.namedItem("hours") as HTMLInputElement).value,
                        10
                      );
                      const max = parseInt(
                        (form.elements.namedItem("max") as HTMLInputElement).value,
                        10
                      );
                      handleSaveConfig(subject.id, hours, max);
                    }}
                    className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs text-slate-700 animate-fadeIn"
                  >
                    <div className="font-semibold text-slate-800">
                      ตั้งค่าชั่วโมงเรียน & โควตาการขาด
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 text-slate-500">
                          ชั่วโมงเรียนทั้งหมด:
                        </label>
                        <input
                          type="number"
                          name="hours"
                          defaultValue={totalHours}
                          min={1}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-slate-500">
                          ขาดได้สูงสุด (ครั้ง):
                        </label>
                        <input
                          type="number"
                          name="max"
                          defaultValue={maxAbsence}
                          min={1}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setEditingSubject(null)}
                        className="px-3 py-1 rounded bg-slate-200 hover:bg-slate-300 cursor-pointer font-medium"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 rounded bg-pink-500 text-white hover:bg-pink-600 cursor-pointer font-medium"
                      >
                        บันทึก
                      </button>
                    </div>
                  </form>
                )}

                {/* EXACT SPECIFICATION REQUIREMENT DISPLAY:
                    "วิชาจีบสาว จส676767 โดยครูพี่ปูน ขาด 2/4 จากทั้งหมด 67ชั่วโมงเรียน"
                    "(เลขแรกคือเลขที่ขาด เลขสองคือขาดได้ทั้งหมด) ตอนคำนวนวันขาด ให้คำนวนถึง ปัจจุบัน" */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-1.5">
                  <div className="text-sm font-semibold text-slate-700 leading-snug">
                    <span className="text-slate-900 font-bold">{subject.subject}</span>{" "}
                    <span className="font-mono text-slate-600">{subject.id}</span>{" "}
                    <span>โดย {subject.teacher}</span>{" "}
                    <span className="inline-block mt-1 sm:mt-0 font-bold text-pink-600">
                      ขาด {totalMissed}/{maxAbsence} จากทั้งหมด {totalHours}ชั่วโมงเรียน
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    *(เลขแรกคือเลขที่ขาด เลขสองคือขาดได้ทั้งหมด) คำนวณถึงปัจจุบัน
                  </div>
                </div>

                {/* Progress Bar & Status Badge */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">
                      ใช้โควตาขาดเรียน:{" "}
                      <span className="font-semibold text-slate-700">
                        {percentageUsed}%
                      </span>
                    </span>

                    {/* Status Badges */}
                    {isOverQuota ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[11px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        <FaTimesCircle size={11} /> ขาดเกินโควตา (มส.)
                      </span>
                    ) : isAtQuota ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <FaExclamationTriangle size={11} /> ครบโควตาแล้ว (ห้ามขาดอีก)
                      </span>
                    ) : isWarning ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                        <FaExclamationTriangle size={11} /> เสี่ยง (เหลืออีก {remainingQuota} ครั้ง)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <FaCheckCircle size={11} /> ปลอดภัย (เหลืออีก {remainingQuota} ครั้ง)
                      </span>
                    )}
                  </div>

                  {/* Progress track */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
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

                {/* Quick Action +/- Buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    ปรับยอดขาดเรียนแบบรวดเร็ว:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdjustAbsence(subject.id, -1)}
                      disabled={totalMissed <= 0}
                      className="p-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition"
                      title="ลดการขาด 1 ครั้ง"
                    >
                      <FaMinus size={10} /> ลด
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustAbsence(subject.id, 1)}
                      className="p-1.5 px-2.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition active:scale-95"
                      title="เพิ่มการขาด 1 ครั้ง"
                    >
                      <FaPlus size={10} /> บันทึกขาด (+1)
                    </button>
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
