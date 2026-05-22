import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { io } from "socket.io-client";
import { logout } from "../../store/slices/authSlice";
import Button from "../ui/Button";
import api from "../../lib/api";
import { resolveSocketUrl } from "../../lib/socket";
import {
  applyAllRead,
  applyNotificationUpdate,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  receiveLiveNotification,
  resetNotifications,
} from "../../store/slices/notificationsSlice";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { items: notifications, unreadCount } = useSelector((s) => s.notifications);
  const profileLabel = `${(user?.name || user?.email || "User").split(" ")[0]} Profile`;
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const wrapperRef = useRef(null);
  const notificationRef = useRef(null);
  const socketRef = useRef(null);
  const suggestionRequestIdRef = useRef(0);
  const districtHint = useMemo(
    () => user?.ownerProfile?.address?.city?.trim() || "",
    [user?.ownerProfile?.address?.city]
  );
  const cityHint = useMemo(
    () => user?.ownerProfile?.address?.city?.trim() || "",
    [user?.ownerProfile?.address?.city]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (location.pathname === "/products") {
        setSearch(searchParams.get("search") || "");
        return;
      }
      setSearch("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.pathname, searchParams]);

  const onLogout = async () => {
    await dispatch(logout());
    dispatch(resetNotifications());
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
    setSuggestionOpen(false);
  };

  useEffect(() => {
    const onClickAway = (event) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target)) {
        setSuggestionOpen(false);
      }

      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  useEffect(() => {
    if (!user?._id) {
      dispatch(resetNotifications());
      return undefined;
    }

    dispatch(fetchNotifications({ limit: 20 }));

    const socket = io(resolveSocketUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("notification:new", (payload) => {
      dispatch(receiveLiveNotification(payload));
    });
    socket.on("notification:updated", (payload) => {
      dispatch(applyNotificationUpdate(payload));
    });
    socket.on("notification:all-read", (payload) => {
      dispatch(applyAllRead(payload));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dispatch, user?._id]);

  const handleNotificationClick = async (notification) => {
    if (!notification?._id) return;

    if (!notification.isRead) {
      await dispatch(markNotificationRead(notification._id));
    }

    const conversationId = notification?.data?.conversationId;
    if (conversationId) {
      navigate(`/chat?conversation=${conversationId}`);
    } else {
      navigate("/chat");
    }
    setNotificationOpen(false);
  };

  const handleReadAllNotifications = async () => {
    await dispatch(markAllNotificationsRead());
  };

  useEffect(() => {
    const q = search.trim();
    const clearSuggestions = () => {
      setSuggestions([]);
      setSuggestionLoading(false);
      setSuggestionOpen(false);
    };

    if (q.length < 2) {
      const timer = window.setTimeout(clearSuggestions, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const requestId = suggestionRequestIdRef.current + 1;
    suggestionRequestIdRef.current = requestId;
    const timer = window.setTimeout(async () => {
      setSuggestionLoading(true);
      try {
        const res = await api.get("/products/suggestions", {
          params: {
            search: q,
            district: districtHint || undefined,
            city: cityHint || undefined,
            limit: 6,
          },
        });
        if (cancelled || suggestionRequestIdRef.current !== requestId) return;
        setSuggestions(res.data?.data?.suggestions || []);
        setSuggestionOpen(true);
      } catch {
        if (cancelled || suggestionRequestIdRef.current !== requestId) return;
        setSuggestions([]);
      } finally {
        if (!cancelled && suggestionRequestIdRef.current === requestId) {
          setSuggestionLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cityHint, districtHint, search]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-blue-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-end gap-2">
          <span className="text-2xl font-extrabold tracking-tight text-slate-900">
            Rental Hub<span className="text-blue-600">.</span>
          </span>
          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
            RENT
          </span>
        </Link>

        <div className="hidden flex-1 items-center md:flex">
          <form className="relative w-full" onSubmit={onSearchSubmit} ref={wrapperRef}>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSuggestionOpen(true);
              }}
              onFocus={() => {
                if (suggestions.length) setSuggestionOpen(true);
              }}
              placeholder="Search for cameras, laptops, audio equipment, and more"
              aria-label="Search rental products"
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 pr-24 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Search
            </button>
            {suggestionOpen && (suggestions.length || suggestionLoading) ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                {suggestionLoading ? (
                  <div className="px-4 py-3 text-xs font-semibold text-slate-500">
                    Finding suggestions...
                  </div>
                ) : (
                  <div className="py-1">
                    {suggestions.map((item) => {
                      const href = `/products/${item.slug || item._id}`;
                      const locationLabel = [item?.location?.city, item?.location?.state]
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <Link
                          key={item._id}
                          to={href}
                          onClick={() => setSuggestionOpen(false)}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition hover:bg-blue-50"
                        >
                          <span className="min-w-0 truncate font-semibold text-slate-800">{item.title}</span>
                          <span className="shrink-0 text-xs font-semibold text-slate-500">
                            {locationLabel || "Nearby"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </form>
        </div>

        <nav className="ml-auto flex items-center gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `hidden rounded-xl px-3 py-2 text-sm font-semibold md:inline-flex ${
                isActive ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-blue-50"
              }`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/products"
            className={({ isActive }) =>
              `hidden rounded-xl px-3 py-2 text-sm font-semibold md:inline-flex ${
                isActive ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-blue-50"
              }`
            }
          >
            Browse
          </NavLink>

          {!user ? (
            <>
              <Button variant="secondary" className="hidden md:inline-flex" as={Link} to="/register">
                Create Account
              </Button>
              <Button as={Link} to="/login">
                Sign In
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink
                to="/list"
                className={({ isActive }) =>
                  `inline-flex rounded-xl px-2.5 py-2 text-xs font-semibold md:px-3 md:text-sm ${
                    isActive ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-blue-50"
                  }`
                }
              >
                List Item
              </NavLink>
              <NavLink
                to="/chat"
                className={({ isActive }) =>
                  `inline-flex rounded-xl px-2.5 py-2 text-xs font-semibold md:px-3 md:text-sm ${
                    isActive ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-blue-50"
                  }`
                }
              >
                Messages
              </NavLink>
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => setNotificationOpen((current) => !current)}
                  className="relative inline-flex rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 md:px-3 md:text-sm"
                >
                  Alerts
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </button>

                {notificationOpen ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                    <div className="flex items-center justify-between border-b border-blue-100 px-4 py-3">
                      <div className="text-sm font-extrabold text-slate-800">Notifications</div>
                      <button
                        type="button"
                        onClick={handleReadAllNotifications}
                        disabled={!unreadCount}
                        className="text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length ? (
                        notifications.map((notification) => (
                          <button
                            key={notification._id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full border-b border-blue-50 px-4 py-3 text-left transition hover:bg-blue-50 ${
                              notification.isRead ? "bg-white" : "bg-blue-50/60"
                            }`}
                          >
                            <div className="text-sm font-bold text-slate-800">{notification.title}</div>
                            <div className="mt-1 text-xs font-semibold text-slate-600">{notification.body}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center text-xs font-semibold text-slate-500">
                          No notifications yet.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <NavLink
                to="/account"
                className={({ isActive }) =>
                  `inline-flex rounded-xl px-2.5 py-2 text-xs font-semibold md:px-3 md:text-sm ${
                    isActive ? "bg-blue-100 text-blue-700" : "text-slate-700 hover:bg-blue-50"
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
