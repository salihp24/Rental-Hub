import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../store/slices/authSlice";
import Button from "../ui/Button";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const profileLabel = `${(user?.name || user?.email || "User").split(" ")[0]} Profile`;
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (location.pathname === "/products") {
      setSearch(searchParams.get("search") || "");
      return;
    }

    setSearch("");
  }, [location.pathname, searchParams]);

  const onLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();

    const query = search.trim();
    const nextParams = new URLSearchParams();

    if (query) nextParams.set("search", query);
    nextParams.set("page", "1");
    nextParams.set("limit", "12");
    nextParams.set("sort", "newest");

    navigate({
      pathname: "/products",
      search: `?${nextParams.toString()}`,
    });
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
          <form className="relative w-full" onSubmit={onSearchSubmit}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cameras, laptops, audio gear, and more"
              aria-label="Search rental products"
              className="w-full rounded-xl border border-black/10 bg-white/95 px-4 py-2.5 text-sm outline-none placeholder:text-black/40 focus:border-black/25 focus:ring-2 focus:ring-black/10"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/85"
            >
              Search
            </button>
          </form>
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
          <NavLink
            to="/products"
            className={({ isActive }) =>
              `hidden rounded-xl px-3 py-2 text-sm font-semibold md:inline-flex ${
                isActive ? "bg-black/10 text-black" : "text-black/80 hover:bg-black/5"
              }`
            }
          >
            Browse
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
              <NavLink
                to="/chat"
                className={({ isActive }) =>
                  `inline-flex rounded-xl px-2.5 py-2 text-xs font-semibold md:px-3 md:text-sm ${
                    isActive ? "bg-black/10 text-black" : "text-black/80 hover:bg-black/5"
                  }`
                }
              >
                Chat
              </NavLink>
              <NavLink
                to="/account"
                className={({ isActive }) =>
                  `inline-flex rounded-xl px-2.5 py-2 text-xs font-semibold md:px-3 md:text-sm ${
                    isActive ? "bg-black/10 text-black" : "text-black/80 hover:bg-black/5"
                  }`
                }
              >
                {profileLabel}
              </NavLink>
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
