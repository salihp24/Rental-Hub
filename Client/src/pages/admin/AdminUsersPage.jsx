import { useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import UsersSection from "./UsersSection";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/users?limit=20&sort=-createdAt");
      setUsers(res?.data?.data?.users || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateUserStatus = async (userId, isActive) => {
    setBusyKey(`user-status-${userId}`);
    try {
      const res = await api.patch(`/admin/users/${userId}/status`, { isActive });
      const updatedUser = res?.data?.data?.user;
      if (updatedUser?._id) {
        setUsers((prev) => prev.map((user) => (user._id === updatedUser._id ? updatedUser : user)));
      }
    } finally {
      setBusyKey("");
    }
  };

  const updateUserRole = async (userId, roleValue) => {
    setBusyKey(`user-role-${userId}`);
    try {
      const res = await api.patch(`/admin/users/${userId}/role`, { role: [roleValue] });
      const updatedUser = res?.data?.data?.user;
      if (updatedUser?._id) {
        setUsers((prev) => prev.map((user) => (user._id === updatedUser._id ? updatedUser : user)));
      }
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">User Management</h1>
          <Button onClick={loadUsers}>Refresh</Button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm">Loading users...</div>
      ) : (
        <UsersSection
          users={users}
          busyKey={busyKey}
          onUpdateUserRole={updateUserRole}
          onUpdateUserStatus={updateUserStatus}
        />
      )}
    </div>
  );
}
