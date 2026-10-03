"use client";

import { useState, useMemo } from "react";

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

interface DayOffEditorProps {
  initialDayoffs: Record<string, number>;
  calendarStart: string; // YYYY-MM-DD
  calendarEnd: string;   // YYYY-MM-DD or YYYY-MM
}

export default function DayOffEditor({
  initialDayoffs,
  calendarStart,
  calendarEnd,
}: DayOffEditorProps) {
  const [dayoffs, setDayoffs] = useState<Record<string, number>>(initialDayoffs);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Generate list of months within calendar range
  const months = useMemo(() => {
    const result: { key: string; year: number; month: number }[] = [];
    if (!calendarStart) return result;

    const startParts = calendarStart.split("-").map(Number);
    const endParts = calendarEnd.split("-").map(Number);

    let y = startParts[0];
    let m = startParts[1];
    const endY = endParts[0];
    const endM = endParts[1];

    while (y < endY || (y === endY && m <= endM)) {
      result.push({
        key: `${y}-${String(m).padStart(2, "0")}`,
        year: y,
        month: m,
      });
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return result;
  }, [calendarStart, calendarEnd]);

  const toggleDay = (monthKey: string, day: number) => {
    setDayoffs((prev) => {
      const currentBin = prev[monthKey] || 0;
      const bit = 1 << (day - 1);
      const newBin = currentBin ^ bit;
      return { ...prev, [monthKey]: newBin };
    });
  };

  const isDayOff = (monthKey: string, day: number): boolean => {
    const bin = dayoffs[monthKey] || 0;
    return ((bin >> (day - 1)) & 1) === 1;
  };

  const handleSaveMonth = async (monthKey: string) => {
    setSaving(monthKey);
    try {
      const res = await fetch("/api/admin/dayoff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey, bin: dayoffs[monthKey] || 0 }),
      });
      if (!res.ok) throw new Error("Failed to save");
      showToast(`บันทึกวันหยุด ${monthKey} สำเร็จ ✓`);
    } catch (err) {
      console.error(err);
      showToast("บันทึกล้มเหลว");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {months.length === 0 && (
        <p className="text-sm text-slate-400">ไม่มีข้อมูลช่วงภาคเรียน กรุณาตั้งค่าวันเปิด-ปิดภาคเรียนก่อน</p>
      )}

      {months.map(({ key, year, month }) => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const isSaving = saving === key;

        return (
          <div key={key} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-700">
                {MONTH_NAMES[month - 1]} {year}
              </h4>
              <button
                onClick={() => handleSaveMonth(key)}
                disabled={isSaving}
                className="px-3 py-1 text-xs font-bold bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isSaving ? "..." : "บันทึก"}
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {/* Day labels */}
              {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((label) => (
                <div
                  key={label}
                  className="text-center text-[10px] font-bold text-slate-400 py-1"
                >
                  {label}
                </div>
              ))}

              {/* Leading empty cells */}
              {Array.from({
                length: new Date(year, month - 1, 1).getDay(),
              }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, month - 1, day);
                const dow = date.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isOff = isDayOff(key, day);

                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(key, day)}
                    className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isOff
                        ? "bg-violet-400 text-white shadow-sm ring-1 ring-violet-300"
                        : isWeekend
                          ? "bg-slate-100 text-slate-400 hover:bg-violet-100"
                          : "bg-white text-slate-700 hover:bg-violet-50 border border-slate-200"
                    }`}
                    title={isOff ? `${day}: วันหยุด (คลิกเพื่อยกเลิก)` : `${day}: คลิกเพื่อตั้งเป็นวันหยุด`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-violet-400" />
          <span>วันหยุด</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-white border border-slate-200" />
          <span>วันเรียน</span>
        </div>
        <span className="text-slate-400">คลิกเพื่อสลับ → บันทึกทีละเดือน</span>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
