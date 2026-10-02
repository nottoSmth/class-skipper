"use client";

// Key for storing attendance in localStorage
const ATTENDANCE_STORAGE_KEY = "class_skipper_attendance";
const SUBJECT_CONFIGS_KEY = "class_skipper_subject_configs";
const ATTENDANCE_EVENT = "class_skipper_attendance_updated";

export type AttendanceStatus = "attended" | "absent" | undefined;

export interface SubjectConfig {
  totalHours: number;
  maxAbsence: number;
  manualAbsences: number;
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
