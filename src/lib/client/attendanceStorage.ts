"use client";

// Key for storing attendance in localStorage
const ATTENDANCE_STORAGE_KEY = "class_skipper_attendance";
const SUBJECT_CONFIGS_KEY = "class_skipper_subject_configs";
const ATTENDANCE_EVENT = "class_skipper_attendance_updated";

export type DayStatus = "future" | "dayOff" | "weekend" | "attended" | "partial" | "absent";

export interface SubjectConfig {
  totalHours: number;
  maxAbsence: number;
  manualAbsences: number;
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getPeriodKey(dateKey: string, periodIndex: number): string {
  return `${dateKey}_p${periodIndex}`;
}

export function getAttendanceMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Error reading attendance from localStorage:", e);
    return {};
  }
}

export function saveAttendanceMap(map: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(ATTENDANCE_EVENT));
  } catch (e) {
    console.error("Error saving attendance to localStorage:", e);
  }
}

export function getSubjectConfigs(): Record<string, SubjectConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SUBJECT_CONFIGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Error reading subject configs from localStorage:", e);
    return {};
  }
}

export function saveSubjectConfigs(configs: Record<string, SubjectConfig>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUBJECT_CONFIGS_KEY, JSON.stringify(configs));
    window.dispatchEvent(new CustomEvent(ATTENDANCE_EVENT));
  } catch (e) {
    console.error("Error saving subject configs to localStorage:", e);
  }
}

export function subscribeToAttendance(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleEvent = () => callback();
  window.addEventListener(ATTENDANCE_EVENT, handleEvent);
  window.addEventListener("storage", handleEvent);

  return () => {
    window.removeEventListener(ATTENDANCE_EVENT, handleEvent);
    window.removeEventListener("storage", handleEvent);
  };
}

/**
 * Calculates attendance status for a day based on periods, timetable, and date:
 * - future: date > todayKey -> Gray
 * - dayOff: marked holiday -> Violet
 * - weekend: Sat/Sun
 * - attended: past date where ALL periods are attended -> Green
 * - partial: past date where SOME periods are attended -> Yellow
 * - absent: past date where NO periods attended or default unchecked -> Red
 */
export function getDayAttendanceStatus(
  dateKey: string,
  dayOfWeek: number,
  scheduledPeriods: number[],
  attendanceMap: Record<string, boolean>,
  isDayOff: boolean,
  todayKey: string
): DayStatus {
  if (isDayOff) return "dayOff";
  if (dayOfWeek === 0 || dayOfWeek === 6) return "weekend";

  const isFuture = dateKey > todayKey;
  if (isFuture) {
    // Future dates remain gray
    return "future";
  }

  // Past or Today (dateKey <= todayKey)
  if (scheduledPeriods.length > 0) {
    let attendedCount = 0;
    for (const p of scheduledPeriods) {
      const pKey = getPeriodKey(dateKey, p);
      const periodVal = attendanceMap[pKey];

      if (periodVal !== undefined) {
        if (periodVal === true) attendedCount++;
      } else {
        // Check day-level override if period is not individually set
        const dayVal = attendanceMap[dateKey];
        if (dayVal === true) {
          attendedCount++;
        }
        // If neither is set, default for past is absent (not attended)
      }
    }

    if (attendedCount === scheduledPeriods.length) {
      return "attended"; // เข้าเรียนครบทุกคาบ (เขียว)
    } else if (attendedCount === 0) {
      return "absent"; // ขาดเรียนทุกคาบ / ค่าเริ่มต้น (แดง)
    } else {
      return "partial"; // เข้าไม่ครบ (เหลือง)
    }
  } else {
    // No scheduled periods on this day
    const dayVal = attendanceMap[dateKey];
    if (dayVal === true) {
      return "attended";
    }
    // Default for past date with no check is absent (red)
    return "absent";
  }
}
