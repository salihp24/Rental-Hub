import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { clearAuthError, loginAdmin } from "../../store/slices/authSlice";

export default function AdminLoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, error } = useSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const nextPath = useMemo(() => {
    const from = location.state?.from;
    if (typeof from === "string" && from.startsWith("/admin")) return from;
    return "/admin";
  }, [location.state]);

  useEffect(() => {
    if (user?.role?.includes("admin")) {
      navigate(nextPath, { replace: true });
    }
  }, [user, navigate, nextPath]);

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const action = await dispatch(loginAdmin({ email, password }));
    if (loginAdmin.fulfilled.match(action)) {
      navigate(nextPath, { replace: true });
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2 md:items-stretch">
      <div className="hidden overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm shadow-black/5 md:block">
        <div className="h-full bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-10 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
            Administrator Access
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
            Sign in to the administration panel
          </h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-white/75">
            Use an administrator account to manage users, listings, and bookings.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm shadow-black/5 md:p-10">
        <h2 className="text-2xl font-extrabold text-slate-900">Admin Sign In</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Enter your administrator credentials to continue.
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Email</div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Password</div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <Button className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Signing in..." : "Sign In as Administrator"}
          </Button>
        </form>

        <div className="mt-6 text-sm font-semibold text-slate-600">
          Need regular user access?{" "}
          <Link to="/login" className="font-extrabold text-slate-900 underline">
            Go to User Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
