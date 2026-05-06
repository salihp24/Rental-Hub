import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/bookings", label: "Bookings" },
  { to: "/admin/audit-logs", label: "Audit Logs" },
];

export default function AdminLayout() {
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-2xl border border-black/10 bg-white p-3">
        <p className="px-2 pb-3 text-xs font-bold uppercase tracking-wide text-black/50">
          Admin Panel
        </p>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2 text-sm font-semibold ${
                  isActive ? "bg-black text-white" : "text-black/80 hover:bg-black/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="space-y-4">
        <Outlet />
      </section>
    </div>
  );
}
