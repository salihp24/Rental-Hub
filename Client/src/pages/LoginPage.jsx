import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearAuthError, login } from "../store/slices/authSlice";
import { getApiBaseUrl } from "../lib/api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, error } = useSelector((s) => s.auth);
  const resetMessage = location.state?.message;
  const routedError = location.state?.error;
  const displayError = error || routedError || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isAdminSignInError = displayError === "Please use the admin sign-in page.";
  const apiBase = getApiBaseUrl();
  const googleAuthUrl = `${apiBase.replace(/\/+$/, "")}/users/google`;

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
      <div className="hidden overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm shadow-black/5 md:block">
        <div className="h-full bg-gradient-to-br from-blue-600 via-blue-500 to-blue-100 p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-slate-700">
            Welcome back
          </div>
          <div className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
            Sign in to your account
          </div>
          <div className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">
            Access your listings, bookings, messages, and account settings.
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm shadow-black/5 md:p-10">
        <div className="text-2xl font-extrabold text-slate-900">Sign in</div>
        <div className="mt-1 text-sm font-semibold text-slate-600">
          Enter your email and password to continue.
        </div>

        {displayError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <div>{displayError}</div>
            {isAdminSignInError ? (
              <div className="mt-2">
                <Link to="/admin/login" className="underline">
                  Go to Admin Sign In
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        {resetMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {resetMessage}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Email</div>
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
            <div className="text-xs font-extrabold text-slate-700">Password</div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="pr-20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-blue-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="pt-1 text-right text-xs font-bold">
              <Link to="/forgot-password" className="text-slate-700 underline">
                Forgot password?
              </Link>
            </div>
          </div>

          <Button className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-blue-100" />
          <span className="text-xs font-extrabold uppercase text-slate-500">or</span>
          <div className="h-px flex-1 bg-blue-100" />
        </div>

        <Button as="a" href={googleAuthUrl} variant="secondary" className="w-full">
          Continue with Google
        </Button>

        <div className="mt-6 text-sm font-semibold text-slate-600">
          Don't have an account?{" "}
          <Link to="/register" className="font-extrabold text-slate-900 underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
