import { useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import AdminStatsGrid from "./AdminStatsGrid";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/stats");
      setStats(res?.data?.data?.stats || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load dashboard stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStats();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Admin Dashboard</h1>
            <p className="text-sm text-black/60">Overview of platform activity and moderation.</p>
          </div>
          <Button onClick={loadStats}>Refresh</Button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm">Loading...</div>
      ) : (
        <AdminStatsGrid stats={stats} />
      )}
    </div>
  );
}
