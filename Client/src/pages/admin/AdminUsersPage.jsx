import { useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import UsersSection from "./UsersSection";
import { cardClass } from "./ui.jsx";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadUsers = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("page", String(nextPage));
      params.set("sort", "-createdAt");
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (isActive) params.set("isActive", isActive);

      const res = await api.get(`/admin/users?${params.toString()}`);
      setUsers(res?.data?.data?.users || []);
      setTotalPages(res?.data?.pagination?.pages || 1);
      setTotal(res?.data?.pagination?.total || 0);
      setPage(res?.data?.pagination?.page || nextPage);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers(1);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const toggleOwnerActivity = async (user) => {
    if (!user?.role?.includes("owner")) return;

    const nextSuspended = !user.ownerProfile?.activitySuspended;
    let reason = "";

    if (nextSuspended) {
      reason = window.prompt("Enter a reason (minimum 10 characters):") || "";
      if (reason.trim().length < 10) {
        setError("Update cancelled. Please provide a reason with at least 10 characters.");
        return;
      }
    }

    setBusyKey(`owner-suspend-${user._id}`);
    try {
      const res = await api.patch(`/admin/users/${user._id}/owner-suspension`, {
        suspended: nextSuspended,
        reason: reason.trim(),
      });
      const updatedUser = res?.data?.data?.user;
      if (updatedUser?._id) {
        setUsers((prev) => prev.map((item) => (item._id === updatedUser._id ? updatedUser : item)));
      }
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update owner status.");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-4">
      <div className={`p-5 ${cardClass}`}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">User Management</h1>
          <Button onClick={() => loadUsers(page)}>Refresh</Button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name/email/phone"
            className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
          >
            <option value="">All roles</option>
            <option value="renter">renter</option>
            <option value="owner">owner</option>
            <option value="admin">admin</option>
          </select>
          <select
            value={isActive}
            onChange={(e) => setIsActive(e.target.value)}
            className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
          >
            <option value="">All status</option>
            <option value="true">active</option>
            <option value="false">inactive</option>
          </select>
          <Button onClick={() => loadUsers(1)}>Apply Filters</Button>
        </div>
        <p className="mt-2 text-xs text-black/60">Total users: {total}</p>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      {loading ? (
        <div className={`p-5 text-sm ${cardClass}`}>Loading users...</div>
      ) : (
        <>
          <UsersSection
            users={users}
            busyKey={busyKey}
            onUpdateUserStatus={updateUserStatus}
            onToggleOwnerActivity={toggleOwnerActivity}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => loadUsers(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm font-semibold">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => loadUsers(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
