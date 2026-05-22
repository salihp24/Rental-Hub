import { useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import { cardClass } from "./ui.jsx";

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
    .format(Number(value || 0));

export default function AdminFinancePage() {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [finance, setFinance] = useState(null);

  const loadFinance = async (nextDays = days) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/admin/finance?days=${nextDays}`);
      setFinance(res?.data?.data?.finance || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load finance dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFinance(7);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = finance?.totals || {};
  const paymentBreakdown = finance?.paymentStatusBreakdown || {};
  const trend = finance?.trend || [];

  return (
    <div className="space-y-4">
      <div className={`p-5 ${cardClass}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">Finance Dashboard</h1>
            <p className="text-sm text-black/60">View total sales, platform fees, refunds, and net revenue.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
            </select>
            <Button onClick={() => loadFinance(days)}>Apply</Button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      {loading ? (
        <div className={`p-5 text-sm ${cardClass}`}>Loading finance metrics...</div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`p-4 ${cardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/50">Total Sales Value</p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(totals.grossVolume)}</p>
            </div>
            <div className={`p-4 ${cardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/50">Platform Revenue</p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(totals.platformRevenue)}</p>
            </div>
            <div className={`p-4 ${cardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/50">Refunded Amount</p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(totals.refundedAmount)}</p>
            </div>
            <div className={`p-4 ${cardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/50">Net Revenue</p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(totals.netRevenue)}</p>
            </div>
          </section>

          <section className={`p-4 ${cardClass}`}>
            <h2 className="mb-3 text-lg font-extrabold">Payment Status Breakdown</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-emerald-50 p-3 text-sm">
                <p className="text-emerald-800/80">Paid</p>
                <p className="text-xl font-extrabold text-emerald-900">{paymentBreakdown.paid || 0}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-sm">
                <p className="text-amber-800/80">Unpaid</p>
                <p className="text-xl font-extrabold text-amber-900">{paymentBreakdown.unpaid || 0}</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 text-sm">
                <p className="text-rose-800/80">Refunded</p>
                <p className="text-xl font-extrabold text-rose-900">{paymentBreakdown.refunded || 0}</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-3 text-sm">
                <p className="text-orange-800/80">Partially Refunded</p>
                <p className="text-xl font-extrabold text-orange-900">{paymentBreakdown.partially_refunded || 0}</p>
              </div>
            </div>
          </section>

          <section className={`p-4 ${cardClass}`}>
            <h2 className="mb-3 text-lg font-extrabold">Daily Trend</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10 text-black/60">
                    <th className="py-2">Date</th>
                    <th className="py-2">Bookings</th>
                    <th className="py-2">Total Sales</th>
                    <th className="py-2">Platform Revenue</th>
                    <th className="py-2">Refunded</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((row) => (
                    <tr key={row.date} className="border-b border-black/5">
                      <td className="py-2">{row.date}</td>
                      <td className="py-2">{row.bookings}</td>
                      <td className="py-2">{formatCurrency(row.grossVolume)}</td>
                      <td className="py-2">{formatCurrency(row.platformRevenue)}</td>
                      <td className="py-2">{formatCurrency(row.refundedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
