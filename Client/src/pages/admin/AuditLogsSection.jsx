import { cardClass } from "./ui.jsx";

export default function AuditLogsSection({ logs }) {
  return (
    <section className={`p-4 ${cardClass}`}>
      <h2 className="mb-3 text-lg font-extrabold">Latest Audit Logs</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/60">
              <th className="py-2">Action</th>
              <th className="py-2">Actor</th>
              <th className="py-2">Entity</th>
              <th className="py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-b border-black/5 transition hover:bg-black/[0.02]">
                <td className="py-2">
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                    {log.action}
                  </span>
                </td>
                <td className="py-2">{log.actor?.email || "-"}</td>
                <td className="py-2">
                  {log.entityType} / {String(log.entityId || "").slice(-6)}
                </td>
                <td className="py-2">{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
