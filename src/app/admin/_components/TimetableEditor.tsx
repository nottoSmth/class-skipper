"use client";

import { useState, useEffect, useCallback } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

interface PeriodData {
  id: string;
  subject: string;
  teacher: string;
}

type TimetableData = Record<string, Record<string, PeriodData>>;

interface TimetableEditorProps {
  roomId: string;
  allRoomIds: string[];
  canSwitchRoom: boolean;
}

export default function TimetableEditor({
  roomId: initialRoomId,
  allRoomIds,
  canSwitchRoom,
}: TimetableEditorProps) {
  const [roomId, setRoomId] = useState(initialRoomId);
  const [timetable, setTimetable] = useState<TimetableData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editCell, setEditCell] = useState<{
    dayId: string;
    periodId: string;
    data: PeriodData;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const fetchTimetable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/timetable?roomId=${roomId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTimetable(data.timetable || {});
    } catch (err) {
      console.error(err);
      showToast("โหลดข้อมูลตารางเรียนล้มเหลว");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  const handleSave = async (
    dayId: string,
    periodId: string,
    data: PeriodData | null
  ) => {
    const key = `${dayId}-${periodId}`;
    setSaving(key);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, dayId, periodId, data }),
      });
      if (!res.ok) throw new Error("Failed to save");

      // Update local state
      setTimetable((prev) => {
        const next = { ...prev };
        if (!next[dayId]) next[dayId] = {};
        if (data === null) {
          delete next[dayId][periodId];
        } else {
          next[dayId][periodId] = data;
        }
        return next;
      });
      showToast("บันทึกสำเร็จ ✓");
      setEditCell(null);
    } catch (err) {
      console.error(err);
      showToast("บันทึกล้มเหลว");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Room Selector (admin only) */}
      {canSwitchRoom && allRoomIds.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-600">ห้อง:</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-sm font-medium focus:ring-2 focus:ring-pink-400 focus:outline-none"
          >
            {allRoomIds.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500 mx-auto mb-2"></div>
          กำลังโหลดตารางเรียน...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-tl-lg">
                  คาบ
                </th>
                {DAYS.map((day) => (
                  <th
                    key={day}
                    className="px-3 py-2 text-center text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => (
                <tr key={p}>
                  <td className="px-3 py-2 text-center font-bold text-slate-600 bg-slate-50/50 border border-slate-200 w-16">
                    {p}
                  </td>
                  {DAYS.map((_, dayIdx) => {
                    const dayId = String(dayIdx + 1);
                    const periodId = String(p);
                    const cell = timetable[dayId]?.[periodId];
                    const isEditing =
                      editCell?.dayId === dayId &&
                      editCell?.periodId === periodId;
                    const isSaving = saving === `${dayId}-${periodId}`;

                    return (
                      <td
                        key={dayId}
                        className={`px-2 py-1.5 border border-slate-200 align-top min-w-[140px] transition-colors ${
                          isEditing
                            ? "bg-pink-50 ring-2 ring-pink-300 ring-inset"
                            : cell
                              ? "bg-white hover:bg-slate-50"
                              : "bg-slate-50/30 hover:bg-slate-50"
                        }`}
                      >
                        {isEditing ? (
                          <EditForm
                            initial={editCell!.data}
                            isSaving={isSaving}
                            onSave={(data) =>
                              handleSave(dayId, periodId, data)
                            }
                            onDelete={() =>
                              handleSave(dayId, periodId, null)
                            }
                            onCancel={() => setEditCell(null)}
                          />
                        ) : cell ? (
                          <button
                            onClick={() =>
                              setEditCell({
                                dayId,
                                periodId,
                                data: {
                                  id: cell.id || "",
                                  subject: cell.subject || "",
                                  teacher: cell.teacher || "",
                                },
                              })
                            }
                            className="w-full text-left group cursor-pointer"
                          >
                            <div className="text-xs font-bold text-slate-800 group-hover:text-pink-600 transition-colors">
                              {cell.subject || "—"}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {cell.id || ""}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {cell.teacher || ""}
                            </div>
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setEditCell({
                                dayId,
                                periodId,
                                data: {
                                  id: "",
                                  subject: "",
                                  teacher: "",
                                },
                              })
                            }
                            className="w-full h-full min-h-[40px] flex items-center justify-center text-slate-300 hover:text-pink-400 transition-colors cursor-pointer"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in z-50">
          {toast}
        </div>
      )}

      {/* Edit Modal Overlay */}
    </div>
  );
}

function EditForm({
  initial,
  isSaving,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: PeriodData;
  isSaving: boolean;
  onSave: (data: PeriodData) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [subject, setSubject] = useState(initial.subject);
  const [id, setId] = useState(initial.id);
  const [teacher, setTeacher] = useState(initial.teacher);
  const hasContent = initial.subject || initial.id || initial.teacher;

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="วิชา"
        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-pink-400 focus:outline-none"
        autoFocus
      />
      <input
        type="text"
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="รหัสวิชา"
        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-pink-400 focus:outline-none font-mono"
      />
      <input
        type="text"
        value={teacher}
        onChange={(e) => setTeacher(e.target.value)}
        placeholder="ผู้สอน"
        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-pink-400 focus:outline-none"
      />
      <div className="flex gap-1 mt-0.5">
        <button
          onClick={() => onSave({ id, subject, teacher })}
          disabled={isSaving}
          className="flex-1 px-2 py-1 text-[10px] font-bold bg-pink-500 text-white rounded-md hover:bg-pink-600 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {isSaving ? "..." : "บันทึก"}
        </button>
        {hasContent && (
          <button
            onClick={onDelete}
            disabled={isSaving}
            className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-600 rounded-md hover:bg-red-200 disabled:opacity-50 cursor-pointer transition-colors"
          >
            ลบ
          </button>
        )}
        <button
          onClick={onCancel}
          className="px-2 py-1 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 cursor-pointer transition-colors"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
