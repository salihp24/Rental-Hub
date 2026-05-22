import { NavLink, Outlet } from "react-router-dom";
import { Icon, cardClass } from "./ui.jsx";

const navItems = [
  { to: "/admin", label: "Dashboard", end: true, icon: Icon.dashboard },
  { to: "/admin/users", label: "Users", icon: Icon.users },
  { to: "/admin/categories", label: "Categories", icon: Icon.category },
  { to: "/admin/products", label: "Products", icon: Icon.product },
  { to: "/admin/bookings", label: "Bookings", icon: Icon.booking },
  { to: "/admin/finance", label: "Finance", icon: Icon.finance },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: Icon.audit },
];

export default function AdminLayout() {
  return (
    <div className="grid gap-4 md:grid-cols-[250px_1fr]">
      <aside className={`h-fit p-3 md:sticky md:top-24 ${cardClass}`}>
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
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
                    : "text-black/80 hover:bg-black/5 hover:translate-x-0.5"
                }`
              }
            >
              <item.icon />
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
