export default function AdminStatsGrid({ stats }) {
  const quickStats = [
    { label: "Users", value: stats?.users?.total ?? "-" },
    { label: "Active Products", value: stats?.products?.active ?? "-" },
    { label: "Pending Bookings", value: stats?.bookings?.pending ?? "-" },
    { label: "New Bookings (7d)", value: stats?.growth?.bookings7d ?? "-" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {quickStats.map((item) => (
        <div key={item.label} className="rounded-2xl border border-black/10 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/50">{item.label}</p>
          <p className="mt-1 text-2xl font-black">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
