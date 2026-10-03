"use client";

import { useState } from "react";

interface CalendarEditorProps {
  initialStart: string;
  initialEnd: string;
}

export default function CalendarEditor({
  initialStart,
  initialEnd,
}: CalendarEditorProps) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });
      if (!res.ok) throw new Error("Failed to save");
      showToast("บันทึกวันเปิด-ปิดภาคเรียนสำเร็จ ✓");
      setDirty(false);
    } catch (err) {
      console.error(err);
      showToast("บันทึกล้มเหลว");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">
            วันเปิดภาคเรียน (Start)
          </label>
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setDirty(true);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm font-medium focus:ring-2 focus:ring-pink-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5">
            วันปิดภาคเรียน (End)
          </label>
          <input
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setDirty(true);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm font-medium focus:ring-2 focus:ring-pink-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-2 text-sm font-bold bg-pink-500 text-white rounded-xl hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-sm"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        {dirty && (
          <span className="text-xs text-amber-600 font-medium">
            • มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
          </span>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
