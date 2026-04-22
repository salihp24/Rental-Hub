import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../store/slices/authSlice";
import Button from "../ui/Button";

export default function Navbar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const onLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/10 bg-[#FFC800]">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-end gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-black">
            Rental 
            Hub<span className="text-black/70">.</span>
          </span>
          <span className="rounded-md bg-black/10 px-2 py-0.5 text-[11px] font-bold text-black/80">
            RENT
          </span>
        </Link>

        <div className="hidden flex-1 items-center md:flex">
          <div className="relative w-full">
            <input
              placeholder="Search for cameras, gadgets, accessories…"
              className="w-full rounded-xl border border-black/10 bg-white/95 px-4 py-2.5 text-sm outline-none placeholder:text-black/40 focus:border-black/25 focus:ring-2 focus:ring-black/10"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/50">
              ⌘K
            </div>
          </div>
        </div>

        <nav className="ml-auto flex items-center gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `hidden rounded-xl px-3 py-2 text-sm font-semibold md:inline-flex ${
                isActive ? "bg-black/10 text-black" : "text-black/80 hover:bg-black/5"
              }`
            }
          >
            Home
          </NavLink>

          {!user ? (
            <>
              <Button
                variant="secondary"
                className="hidden md:inline-flex"
                as={Link}
                to="/register"
              >
                Create account
              </Button>
              <Button as={Link} to="/login">
                Login
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink
                to="/list"
                className={({ isActive }) =>
                  `inline-flex rounded-xl px-2.5 py-2 text-xs font-semibold md:px-3 md:text-sm ${
                    isActive ? "bg-black/10 text-black" : "text-black/80 hover:bg-black/5"
                  }`
                }
              >
                List
              </NavLink>
              <div className="hidden flex-col items-end md:flex">
                <div className="text-xs font-semibold text-black/70">Signed in</div>
                <div className="max-w-[180px] truncate text-sm font-bold text-black">
                  {user.name || user.email}
                </div>
              </div>
              <Button variant="secondary" onClick={onLogout}>
                Logout
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}