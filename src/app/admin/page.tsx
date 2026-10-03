// Admin page — Server Component
// Auth is checked server-side. Only admin/privileged users can access.
// Privileged users see ONLY the timetable editor for their room.
// Admin users see everything.
// Data is fetched server-side so unauthorized users never receive it.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/server/server.session";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";
import TimetableEditor from "./_components/TimetableEditor";
import CalendarEditor from "./_components/CalendarEditor";
import DayOffEditor from "./_components/DayOffEditor";
import UserEditor from "./_components/UserEditor";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentTab = params.tab || "timetable";
  const user = await getSessionUser();

  // Not logged in → redirect to login
  if (!user) {
    redirect("/login");
  }

  // Regular users cannot access
  if (user.role !== "admin" && user.role !== "privileged") {
    redirect("/");
  }

  const isAdmin = user.role === "admin";
  const db = getFirestoreDB();

  // Fetch data server-side — only for sections the user is allowed to see
  let allRoomIds: string[] = [];
  let calendarStart = "";
  let calendarEnd = "";
  let dayoffs: Record<string, number> = {};

  // Both admin and privileged need room list (admin for switching, privileged just their room)
  try {
    const roomsSnap = await db.collection("rooms").get();
    allRoomIds = roomsSnap.docs.map((d) => d.id);
  } catch (err) {
    console.error("Error fetching rooms:", err);
  }

  // Only admin gets calendar and day-off data
  if (isAdmin) {
    try {
      const calSnap = await db.collection("calendar").doc("properties").get();
      if (calSnap.exists) {
        const calData = calSnap.data()!;
        calendarStart = calData["start-calendar"] || "";
        calendarEnd = calData["end-calendar"] || "";
      }
    } catch (err) {
      console.error("Error fetching calendar:", err);
    }

    try {
      const dayoffSnap = await db
        .collection("calendar")
        .doc("properties")
        .collection("day-off")
        .get();
      dayoffSnap.docs.forEach((d) => {
        dayoffs[d.id] = d.data()?.bin ?? 0;
      });
    } catch (err) {
      console.error("Error fetching day-offs:", err);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/40">
      {/* Header */}
      <header className="w-full bg-slate-800 text-white py-3 px-4 sm:px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← กลับ
            </Link>
            <h1 className="text-lg font-bold">
              Admin Panel
            </h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isAdmin
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              {isAdmin ? "Master Admin" : "Privileged User"}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {user.username} • ห้อง {user.room || "—"}
          </div>
        </div>
      </header>

      {isAdmin && (
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <nav className="flex space-x-6">
              <Link
                href="?tab=timetable"
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  currentTab === "timetable"
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                ตารางเรียน
              </Link>
              <Link
                href="?tab=users"
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  currentTab === "users"
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                จัดการผู้ใช้งาน
              </Link>
              <Link
                href="?tab=calendar"
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  currentTab === "calendar"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                วันเปิด-ปิด / วันหยุด
              </Link>
            </nav>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
        {/* === Section: Calendar Dates (admin only) === */}
        {isAdmin && currentTab === "calendar" && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                วันเปิด-ปิดภาคเรียน
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                กำหนดช่วงวันที่ของภาคเรียน
              </p>
            </div>
            <div className="p-6">
              <CalendarEditor
                initialStart={calendarStart}
                initialEnd={calendarEnd}
              />
            </div>
          </section>
        )}

        {/* === Section: Day Off (admin only) === */}
        {isAdmin && currentTab === "calendar" && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-6 py-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                </svg>
                วันหยุด
              </h2>
              <p className="text-xs text-violet-100 mt-0.5">
                คลิกวันที่เพื่อกำหนดเป็นวันหยุด (สีม่วง)
              </p>
            </div>
            <div className="p-6">
              <DayOffEditor
                initialDayoffs={dayoffs}
                calendarStart={calendarStart}
                calendarEnd={calendarEnd}
              />
            </div>
          </section>
        )}

        {/* === Section: User Management (admin only) === */}
        {isAdmin && currentTab === "users" && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                จัดการผู้ใช้งาน (Users)
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                เพิ่ม ลบ และกำหนดสิทธิ์ผู้ใช้งาน
              </p>
            </div>
            <div className="p-6">
              <UserEditor allRoomIds={allRoomIds} />
            </div>
          </section>
        )}

        {/* === Section: Timetable Editor (admin + privileged) === */}
        {(!isAdmin || currentTab === "timetable") && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              ตารางเรียน
            </h2>
            <p className="text-xs text-pink-100 mt-0.5">
              {isAdmin
                ? "แก้ไขตารางเรียนของทุกห้อง"
                : `แก้ไขตารางเรียนห้อง ${user.room}`}
            </p>
          </div>
          <div className="p-6">
            <TimetableEditor
              roomId={user.room || allRoomIds[0] || "67"}
              allRoomIds={allRoomIds}
              canSwitchRoom={isAdmin}
            />
          </div>
        </section>
        )}
      </main>
    </div>
  );
}
