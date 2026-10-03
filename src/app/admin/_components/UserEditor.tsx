"use client";

import { useState, useEffect, useCallback } from "react";

interface UserData {
  username: string;
  role: string;
  room: string;
}

interface UserEditorProps {
  allRoomIds: string[];
}

export default function UserEditor({ allRoomIds }: UserEditorProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"username" | "room" | "role">("username");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
      showToast("โหลดข้อมูลผู้ใช้ล้มเหลว");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      if (isNewUser) {
        if (!newPassword) {
          showToast("กรุณาใส่รหัสผ่าน");
          setSaving(false);
          return;
        }
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...editUser, password: newPassword }),
        });
        if (!res.ok) throw new Error("Failed to create user");
        showToast("เพิ่มผู้ใช้สำเร็จ ✓");
      } else {
        const res = await fetch("/api/admin/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editUser),
        });
        if (!res.ok) throw new Error("Failed to update user");
        
        if (newPassword) {
          const passRes = await fetch("/api/admin/users/password", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: editUser.username, password: newPassword }),
          });
          if (!passRes.ok) throw new Error("Failed to update password");
        }
        showToast("อัปเดตผู้ใช้สำเร็จ ✓");
      }
      setEditUser(null);
      setIsNewUser(false);
      setNewPassword("");
      fetchUsers();
    } catch (err) {
      console.error(err);
      showToast("บันทึกล้มเหลว");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ ${username}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users?username=${username}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      showToast("ลบผู้ใช้สำเร็จ ✓");
      fetchUsers();
    } catch (err) {
      console.error(err);
      showToast("ลบล้มเหลว");
    } finally {
      setSaving(false);
    }
  };

  const filteredAndSortedUsers = users
    .filter((u) => {
      if (searchQuery && !u.username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (roomFilter !== "all" && (u.room || "") !== (roomFilter === "none" ? "" : roomFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortBy] || "";
      const bVal = b[sortBy] || "";
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้ใช้..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          >
            <option value="all">ทุกสิทธิ์</option>
            <option value="user">User</option>
            <option value="privileged">Privileged User</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          >
            <option value="all">ทุกห้อง</option>
            <option value="none">ไม่มีห้อง</option>
            {allRoomIds.map((r) => (
              <option key={r} value={r}>ห้อง {r}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setEditUser({ username: "", role: "user", room: "" });
            setIsNewUser(true);
            setNewPassword("");
          }}
          className="px-4 py-2 text-sm font-bold bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors shadow-sm cursor-pointer"
        >
          + เพิ่มผู้ใช้ใหม่
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mx-auto mb-2"></div>
          กำลังโหลดข้อมูลผู้ใช้...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th 
                  className="px-3 py-2 text-left text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-tl-lg cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => { setSortBy("username"); setSortOrder(sortBy === "username" && sortOrder === "asc" ? "desc" : "asc"); }}
                >
                  ชื่อผู้ใช้ {sortBy === "username" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th 
                  className="px-3 py-2 text-left text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => { setSortBy("room"); setSortOrder(sortBy === "room" && sortOrder === "asc" ? "desc" : "asc"); }}
                >
                  ห้อง {sortBy === "room" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th 
                  className="px-3 py-2 text-left text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 select-none"
                  onClick={() => { setSortBy("role"); setSortOrder(sortBy === "role" && sortOrder === "asc" ? "desc" : "asc"); }}
                >
                  สิทธิ์ {sortBy === "role" && (sortOrder === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-3 py-2 text-center text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-tr-lg">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-400 border border-slate-200">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((u) => (
                  <tr key={u.username}>
                  <td className="px-3 py-2 border border-slate-200">{u.username}</td>
                  <td className="px-3 py-2 border border-slate-200">{u.room || "—"}</td>
                  <td className="px-3 py-2 border border-slate-200">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      u.role === "admin" ? "bg-red-100 text-red-600" :
                      u.role === "privileged" ? "bg-amber-100 text-amber-600" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {u.role || "user"}
                    </span>
                  </td>
                  <td className="px-3 py-2 border border-slate-200 text-center space-x-2">
                    <button
                      onClick={() => {
                        setEditUser(u);
                        setIsNewUser(false);
                        setNewPassword("");
                      }}
                      className="text-emerald-500 hover:text-emerald-600 text-xs font-bold cursor-pointer"
                    >
                      แก้ไข
                    </button>
                    {u.username !== "admin" && (
                      <button
                        onClick={() => handleDeleteUser(u.username)}
                        className="text-red-500 hover:text-red-600 text-xs font-bold cursor-pointer"
                      >
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              {isNewUser ? "เพิ่มผู้ใช้ใหม่" : "แก้ไขผู้ใช้"}
            </h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ชื่อผู้ใช้</label>
              <input
                type="text"
                value={editUser.username}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                disabled={!isNewUser}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ห้อง</label>
              <select
                value={editUser.room}
                onChange={(e) => setEditUser({ ...editUser, room: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              >
                <option value="">(ไม่มี)</option>
                {allRoomIds.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">สิทธิ์ (Role)</label>
              <select
                value={editUser.role}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              >
                <option value="user">User</option>
                <option value="privileged">Privileged User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {isNewUser ? "รหัสผ่าน" : "เปลี่ยนรหัสผ่าน (เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน)"}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setEditUser(null);
                  setIsNewUser(false);
                  setNewPassword("");
                }}
                className="px-4 py-2 text-sm font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
