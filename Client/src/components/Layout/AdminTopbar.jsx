import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Button from "../ui/Button";
import { logout } from "../../store/slices/authSlice";

const quickLinks = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/bookings", label: "Bookings" },
];

export default function AdminTopbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const adminLabel = user?.email || user?.name || "Administrator";

  const onLogout = async () => {
    await dispatch(logout());
    navigate("/admin/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-blue-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/admin" className="text-lg font-extrabold tracking-tight text-slate-900">
          Admin Panel
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {quickLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  isActive ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-blue-50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/" className="text-xs font-semibold text-slate-600 underline">
            Back to Marketplace
          </Link>
          <span className="hidden rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-slate-700 sm:inline">
            {adminLabel}
          </span>
          <Button variant="secondary" className="px-3 py-2 text-xs" onClick={onLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
