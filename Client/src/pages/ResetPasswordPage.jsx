import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/users/reset-password/${token}`, { password });
      navigate("/login", {
        replace: true,
        state: { message: "Password reset successful. Please sign in." },
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-3xl border border-blue-100 bg-white p-6 shadow-sm shadow-black/5 md:p-10">
      <div className="text-2xl font-extrabold text-slate-900">Set new password</div>
      <div className="mt-1 text-sm font-semibold text-slate-600">
        Choose a new password for your account.
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <div className="text-xs font-extrabold text-slate-700">New password</div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-extrabold text-slate-700">Confirm password</div>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        <Button className="w-full" disabled={loading}>
          {loading ? "Updating password..." : "Reset Password"}
        </Button>
      </form>

      <div className="mt-6 text-sm font-semibold text-slate-600">
        <Link to="/login" className="font-extrabold text-slate-900 underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
