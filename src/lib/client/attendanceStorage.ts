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

/**
 * Parses calendar date strings from Firebase properties.
 * Handles both "YYYY-MM-DD" (e.g. "2026-10-15") and "YYYY-MM" (e.g. "2026-10").
 * When isEnd = true and input is "YYYY-MM", defaults to the last day of that month.
 */
export function parseCalendarPropertyDate(
  val: string | undefined,
  defaultDate: Date,
  isEnd = false
): Date {
  if (!val) return defaultDate;
  const parts = val.trim().split("-").map((p) => parseInt(p, 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const day = isEnd ? new Date(parts[0], parts[1], 0).getDate() : 1;
    return new Date(parts[0], parts[1] - 1, day, 0, 0, 0, 0);
  }
  return defaultDate;
}

/**
 * Returns a standardized "YYYY-MM-DD" dateKey from Firebase property strings.
 */
export function parseCalendarPropertyDateKey(
  val: string | undefined,
  defaultKey: string,
  isEnd = false
): string {
  if (!val) return defaultKey;
  const parts = val.trim().split("-").map((p) => parseInt(p, 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return formatDateKey(parts[0], parts[1], parts[2]);
  }
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const day = isEnd ? new Date(parts[0], parts[1], 0).getDate() : 1;
    return formatDateKey(parts[0], parts[1], day);
  }
  return defaultKey;
}

const THAI_MONTH_SHORT_NAMES = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.trim().split("-").map((p) => parseInt(p, 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const yearBe = parts[0] > 2400 ? parts[0] : parts[0] + 543;
    const monthName = THAI_MONTH_SHORT_NAMES[parts[1] - 1] || "";
    return `${parts[2]} ${monthName} ${yearBe}`;
  }
  return dateStr;
}

export function formatThaiDateRange(startStr: string, endStr: string): string {
  const start = formatThaiDate(startStr);
  const end = formatThaiDate(endStr);
  if (!start && !end) return "";
  if (!end) return start;
  if (!start) return end;
  return `${start} - ${end}`;
}

export function parseDateString(str: string): Date {
  if (!str) return new Date();
  const parts = str.trim().split("-").map((p) => parseInt(p, 10));
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || 1;
  const day = parts[2] || 1;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
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
  todayKey: string,
  calendarStartKey?: string,
  calendarEndKey?: string
): DayStatus {
  if (isDayOff) return "dayOff";
  if (dayOfWeek === 0 || dayOfWeek === 6) return "weekend";

  // If outside calendar range [start, end], treat as future / not reached (gray)
  if (calendarStartKey && dateKey < calendarStartKey) {
    return "future";
  }
  if (calendarEndKey && dateKey > calendarEndKey) {
    return "future";
  }

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
