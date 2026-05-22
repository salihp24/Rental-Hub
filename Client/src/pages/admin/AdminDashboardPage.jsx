import { useCallback, useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import AdminStatsGrid from "./AdminStatsGrid";
import { cardClass } from "./ui.jsx";

const RANGE_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);

  const loadStats = useCallback(async (selectedDays) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/stats", { params: { days: selectedDays } });
      setStats(res?.data?.data?.stats || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load dashboard analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStats(days);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [days, loadStats]);

  return (
    <div className="space-y-4">
      <div className={`p-5 ${cardClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Admin Dashboard</h1>
            <p className="text-sm text-black/60">
              Overview of business performance, bookings, and revenue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDays(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    days === option.value
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-blue-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button onClick={() => loadStats(days)}>Refresh</Button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      {loading ? (
        <div className={`p-5 text-sm ${cardClass}`}>Loading analytics...</div>
      ) : (
        <AdminStatsGrid stats={stats} />
      )}
    </div>
  );
}
