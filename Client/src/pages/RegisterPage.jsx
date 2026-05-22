import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearAuthError, register } from "../store/slices/authSlice";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, status, error } = useSelector((s) => s.auth);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  const onSubmit = async (e) => {
    e.preventDefault();
    await dispatch(register({ name, email, password, phone }));
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2 md:items-stretch">
      <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm shadow-black/5 md:p-10">
        <div className="text-2xl font-extrabold text-slate-900">Create Account</div>
        <div className="mt-1 text-sm font-semibold text-slate-600">
          Create your account to rent items and publish listings.
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Name</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </div>

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
            <div className="text-xs font-extrabold text-slate-700">Phone (optional)</div>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 99999 99999"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-slate-700">Password</div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
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
          </div>

          <Button className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-sm font-semibold text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-extrabold text-slate-900 underline">
            Sign in
          </Link>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm shadow-black/5 md:block">
        <div className="h-full bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-10 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
            Why choose Rental Hub?
          </div>
          <div className="mt-6 text-3xl font-extrabold tracking-tight">
            Earn from items you are not using
          </div>
          <div className="mt-3 text-sm font-semibold leading-relaxed text-white/70">
            Post your items quickly and connect with trusted renters.
          </div>
        </div>
      </div>
    </div>
  );
}
