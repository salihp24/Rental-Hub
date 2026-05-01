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
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm shadow-black/5 md:p-10">
        <div className="text-2xl font-extrabold text-black">Create account</div>
        <div className="mt-1 text-sm font-semibold text-black/55">
          Create your account to rent and list products.
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <div className="text-xs font-extrabold text-black/70">Name</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </div>

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
            <div className="text-xs font-extrabold text-black/70">Phone (optional)</div>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 99999 99999"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-extrabold text-black/70">Password</div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </div>

          <Button className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Creating..." : "Register"}
          </Button>
        </form>

        <div className="mt-6 text-sm font-semibold text-black/60">
          Already have an account?{" "}
          <Link to="/login" className="font-extrabold text-black underline">
            Sign in
          </Link>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm shadow-black/5 md:block">
        <div className="h-full bg-gradient-to-br from-black via-black/90 to-black/80 p-10 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
            Why Rental Hub?
          </div>
          <div className="mt-6 text-3xl font-extrabold tracking-tight">
            Turn unused equipment into income.
          </div>
          <div className="mt-3 text-sm font-semibold leading-relaxed text-white/70">
            Publish products quickly and connect with renters through a simple, professional
            marketplace.
          </div>
        </div>
      </div>
    </div>
  );
}

