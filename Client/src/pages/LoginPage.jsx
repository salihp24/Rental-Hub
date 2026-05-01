import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearAuthError, login } from "../store/slices/authSlice";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, error } = useSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      const next = location.state?.from || "/";
      navigate(next, { replace: true });
    }
  }, [user, navigate, location.state]);

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const onSubmit = async (e) => {
    e.preventDefault();
    await dispatch(login({ email, password }));
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2 md:items-stretch">
      <div className="hidden overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm shadow-black/5 md:block">
        <div className="h-full bg-gradient-to-br from-[#FFC800] via-[#FFD84D] to-[#FFF7D1] p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/10 px-3 py-1 text-xs font-bold text-black/70">
            Welcome back
          </div>
          <div className="mt-6 text-3xl font-extrabold tracking-tight text-black">
            Sign in to continue.
          </div>
          <div className="mt-3 text-sm font-semibold leading-relaxed text-black/60">
            Access your listings, bookings, messages, and account details.
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm shadow-black/5 md:p-10">
        <div className="text-2xl font-extrabold text-black">Sign in</div>
        <div className="mt-1 text-sm font-semibold text-black/55">
          Enter your email and password to access your account.
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-black/70">Email</div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-black/70">Password</div>
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
            {status === "loading" ? "Signing in..." : "Login"}
          </Button>
        </form>

        <div className="mt-6 text-sm font-semibold text-black/60">
          Do not have an account?{" "}
          <Link to="/register" className="font-extrabold text-black underline">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}

