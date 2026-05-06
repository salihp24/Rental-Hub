import { useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import AuditLogsSection from "./AuditLogsSection";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/audit-logs?limit=30&sort=-createdAt");
      setLogs(res?.data?.data?.logs || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadLogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Audit Logs</h1>
          <Button onClick={loadLogs}>Refresh</Button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm">Loading logs...</div>
      ) : (
        <AuditLogsSection logs={logs} />
      )}
    </div>
  );
}
