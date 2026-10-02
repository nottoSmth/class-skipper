"use client";

import { useFirebaseContext } from "@/lib/client/context/firebaseContext";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaSignInAlt,
  FaSpinner,
} from "react-icons/fa";
import { Header } from "@/lib/client/components/Components";
import { logInToFirebase } from "@/lib/client/client.firebaseTokenFetcher";

export default function AuthPage() {
  const { setIsFirebaseReady } = useFirebaseContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await res.json();


      if (!res.ok) {
        console.error(data.error);
        return;
      }
      localStorage.setItem("userData", JSON.stringify(data));
      logInToFirebase(setIsFirebaseReady);
      router.push("/");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <Header />
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
          เข้าสู่ระบบ
        </h1>
        <p className="mt-2 text-md text-gray-400">ระบบช่วยหาวันโดดเรียน</p>
        <p className="text-md text-pink-400 font-medium">
          โรงเรียนเตรียมอุดมศึกษา
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4"
        noValidate
      >
        {/* Username */}
        <div className="relative">
          <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-sm" />
          <input
            type="text"
            placeholder="ชื่อผู้ใช้"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-pink-300 focus:outline-none transition-colors text-gray-900 placeholder:text-gray-300 bg-white"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 text-sm" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full pl-10 pr-12 py-3.5 rounded-xl border-2 border-gray-200 focus:border-pink-300 focus:outline-none transition-colors text-gray-900 placeholder:text-gray-300 bg-slate-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>

        {/* Remember + Forgot */}
        {/* <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-pink-400 cursor-pointer"
            />
            <span className="text-sm text-gray-500">จดจำฉันไว้ในระบบ</span>
          </label>
          <a
            href="#"
            className="text-sm text-pink-400 hover:text-pink-600 font-medium transition-colors"
          >
            ลืมรหัสผ่าน
          </a>
        </div> */}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-pink-400 hover:bg-pink-500 disabled:bg-pink-200 disabled:cursor-not-allowed text-white font-semibold text-base transition-all active:scale-95"
        >
          {loading ? <FaSpinner className="animate-spin" /> : <FaSignInAlt />}
          {loading ? "กำลังเข้าสู่ระบบ..." : "ล็อกอิน"}
        </button>

        {/* Create account */}
        {/* <p className="text-center text-sm text-gray-400">
          <a
            href="#"
            className="hover:text-pink-500 hover:underline transition-colors"
          >
            สร้างบัญชีใหม่
          </a>
        </p> */}
      </form>
    </div>
  );
}
