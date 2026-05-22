import { Icon, cardClass } from "./ui.jsx";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function MiniLineChart({ points }) {
  const width = 680;
  const height = 220;
  const padding = 24;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  if (!points?.length) {
    return <div className="text-sm text-slate-500">No trend data available.</div>;
  }

  const values = points.map((point) => Number(point.revenue || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const path = points
    .map((point, index) => {
      const x = padding + (index / Math.max(points.length - 1, 1)) * usableWidth;
      const y = padding + usableHeight - ((Number(point.revenue || 0) - min) / span) * usableHeight;
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
      <path d={path} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
      {points.map((point, index) => {
        const x = padding + (index / Math.max(points.length - 1, 1)) * usableWidth;
        const y = padding + usableHeight - ((Number(point.revenue || 0) - min) / span) * usableHeight;
        return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="3" fill="#1d4ed8" />;
      })}
    </svg>
  );
}

function DonutChart({ items }) {
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
  const palette = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#ef4444", "#6366f1", "#64748b"];
  const segments = items.reduce((acc, item, index) => {
    const lastEnd = acc.length ? acc[acc.length - 1].end : 0;
    const percentage = (Number(item.count || 0) / total) * 100;
    const end = lastEnd + percentage;
    acc.push({
      end,
      segment: `${palette[index % palette.length]} ${lastEnd}% ${end}%`,
    });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-5">
      <div
        className="h-40 w-40 rounded-full"
        style={{
          background: `conic-gradient(${segments.map((item) => item.segment).join(", ")})`,
        }}
      />
      <div className="space-y-2 text-xs">
        {items.map((item, index) => (
          <div key={item.status} className="flex items-center gap-2 text-slate-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: palette[index % palette.length] }}
            />
            <span className="capitalize">{item.status.replaceAll("_", " ")}</span>
            <span className="font-semibold text-slate-900">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminStatsGrid({ stats }) {
  const analytics = stats?.analytics || {};
  const kpis = analytics.kpis || {};

  const quickStats = [
    { label: "Total Sales Value", value: formatCurrency(kpis.grossVolume), icon: Icon.finance },
    {
      label: "Net Platform Revenue",
      value: formatCurrency(kpis.netPlatformRevenue),
      icon: Icon.finance,
    },
    {
      label: "Booking Approval Rate",
      value: formatPercent(kpis.bookingApprovalRate),
      icon: Icon.booking,
    },
    { label: "Refund Rate", value: formatPercent(kpis.refundRate), icon: Icon.audit },
    {
      label: "Average Booking Value",
      value: formatCurrency(kpis.avgBookingValue),
      icon: Icon.dashboard,
    },
    { label: "Paid Bookings", value: kpis.paidBookings ?? 0, icon: Icon.booking },
  ];

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {quickStats.map((item) => (
          <div
            key={item.label}
            className={`p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(0,0,0,0.1)] ${cardClass}`}
          >
            <div className="mb-2 inline-flex rounded-lg bg-black/5 p-2 text-black/70">
              <item.icon />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-black/50">{item.label}</p>
            <p className="mt-1 text-xl font-black">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={`p-5 ${cardClass}`}>
          <h3 className="text-base font-black">Revenue Trend</h3>
          <p className="mb-3 text-xs text-slate-500">Daily total booking value for the selected period.</p>
          <MiniLineChart points={analytics.trends || []} />
        </div>

        <div className={`p-5 ${cardClass}`}>
          <h3 className="text-base font-black">Bookings by Status</h3>
          <p className="mb-3 text-xs text-slate-500">Distribution of booking statuses.</p>
          <DonutChart items={analytics.bookingsByStatus || []} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className={`p-5 ${cardClass}`}>
          <h3 className="text-base font-black">Top Categories</h3>
          <p className="mb-4 text-xs text-slate-500">Top categories by number of bookings.</p>
          <div className="space-y-3">
            {(analytics.topCategories || []).map((item) => {
              const maxBookings = Math.max(...(analytics.topCategories || []).map((c) => c.bookings), 1);
              const width = `${Math.max(8, (item.bookings / maxBookings) * 100)}%`;
              return (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{item.name}</span>
                    <span className="text-slate-500">{item.bookings} bookings</span>
                  </div>
                  <div className="h-2 rounded-full bg-blue-100">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width }} />
                  </div>
                </div>
              );
            })}
            {!(analytics.topCategories || []).length ? (
              <p className="text-sm text-slate-500">No category data available.</p>
            ) : null}
          </div>
        </div>

        <div className={`p-5 ${cardClass}`}>
          <h3 className="text-base font-black">Booking Progress</h3>
          <p className="mb-4 text-xs text-slate-500">Booking progress from request to completion.</p>
          <div className="space-y-3">
            {(analytics.funnel || []).map((step) => (
              <div key={step.stage} className="rounded-xl border border-blue-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{step.stage}</span>
                  <span className="text-sm font-black text-blue-700">{step.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-blue-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.max(4, Number(step.rate || 0))}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatPercent(step.rate)}</p>
              </div>
            ))}
            {!(analytics.funnel || []).length ? (
              <p className="text-sm text-slate-500">No booking progress data available.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
