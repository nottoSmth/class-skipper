"use client";

import { useState } from "react";
import { Header } from "@/lib/client/components/Components";

export default function SettingsPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Server-returned error for the old password field
  const [oldPasswordError, setOldPasswordError] = useState<string | null>(null);

  // Derived inline errors (shown after user has touched each field)
  const [touched, setTouched] = useState({ old: false, new: false, confirm: false });

  const oldErr = touched.old && !oldPassword ? "กรุณากรอกรหัสผ่านเดิม" : oldPasswordError;
  const newErr =
    touched.new && !newPassword
      ? "กรุณากรอกรหัสผ่านใหม่"
      : touched.new && newPassword.length < 6
      ? "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
      : null;
  const confirmErr =
    touched.confirm && !confirmPassword
      ? "กรุณายืนยันรหัสผ่านใหม่"
      : touched.confirm && confirmPassword !== newPassword
      ? "รหัสผ่านไม่ตรงกัน"
      : null;

  const isValid = !!oldPassword && newPassword.length >= 6 && confirmPassword === newPassword;

  const handleChangePassword = async () => {
    // Mark all touched so errors show
    setTouched({ old: true, new: true, confirm: true });
    setOldPasswordError(null);
    setSuccess(false);
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Show server error inline under the old password field
        setOldPasswordError(data.error || "เกิดข้อผิดพลาด");
      } else {
        setSuccess(true);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTouched({ old: false, new: false, confirm: false });
      }
    } catch {
      setOldPasswordError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:outline-none transition-colors";
  const inputOk = "border-slate-200 focus:ring-pink-400";
  const inputBad = "border-red-300 bg-red-50 focus:ring-red-300";

  return (
    <div className="min-h-screen bg-slate-50/40">
      <Header />
      <main className="max-w-lg mx-auto pt-28 pb-20 px-4">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">ตั้งค่าบัญชี</h2>
          <p className="text-sm text-slate-500 mt-1">จัดการรหัสผ่านของคุณ</p>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              เปลี่ยนรหัสผ่าน
            </h3>
          </div>

          <form
            autoComplete="off"
            onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}
            className="p-6 space-y-5"
          >
            {/* Old password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">รหัสผ่านเดิม</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  setOldPasswordError(null); // clear server error on retype
                }}
                onBlur={() => setTouched((t) => ({ ...t, old: true }))}
                autoComplete="current-password"
                className={`${inputBase} ${oldErr ? inputBad : inputOk}`}
                placeholder="••••••••"
              />
              {oldErr && <p className="text-xs text-red-500 mt-1">{oldErr}</p>}
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                รหัสผ่านใหม่{" "}
                <span className="font-normal text-slate-400">(อย่างน้อย 6 ตัวอักษร)</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, new: true }))}
                autoComplete="new-password"
                className={`${inputBase} ${newErr ? inputBad : inputOk}`}
                placeholder="••••••••"
              />
              {newErr && <p className="text-xs text-red-500 mt-1">{newErr}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                ยืนยันรหัสผ่านใหม่
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
                autoComplete="new-password"
                className={`${inputBase} ${confirmErr ? inputBad : inputOk}`}
                placeholder="••••••••"
              />
              {confirmErr && <p className="text-xs text-red-500 mt-1">{confirmErr}</p>}
            </div>

            {/* Success banner */}
            {success && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                เปลี่ยนรหัสผ่านสำเร็จ
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-bold bg-pink-500 text-white rounded-xl hover:bg-pink-600 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
            </button>
          </form>
        </section>

        <p className="text-center text-xs text-slate-400 mt-8">
          หากพบปัญหาติดต่อเจ้ปูน ห้อง 76 ตึกศิลปะ
        </p>
      </main>
    </div>
  );
}
