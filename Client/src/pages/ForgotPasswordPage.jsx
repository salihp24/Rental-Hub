import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/users/forgot-password", { email });
      setSuccess(
        res?.data?.message || "If an account exists for this email, a reset link has been sent."
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-3xl border border-blue-100 bg-white p-6 shadow-sm shadow-black/5 md:p-10">
      <div className="text-2xl font-extrabold text-slate-900">Forgot password</div>
      <div className="mt-1 text-sm font-semibold text-slate-600">
        Enter your account email and we will send a reset link.
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
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

        <Button className="w-full" disabled={loading}>
          {loading ? "Sending link..." : "Send Reset Link"}
        </Button>
      </form>

      <div className="mt-6 text-sm font-semibold text-slate-600">
        Remembered it?{" "}
        <Link to="/login" className="font-extrabold text-slate-900 underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
