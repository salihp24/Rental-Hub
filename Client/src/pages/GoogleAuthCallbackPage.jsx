import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchCurrentUser } from "../store/slices/authSlice";

export default function GoogleAuthCallbackPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    (async () => {
      const action = await dispatch(fetchCurrentUser());
      if (!active) return;

      if (fetchCurrentUser.fulfilled.match(action)) {
        navigate("/", { replace: true });
      } else {
        navigate("/login", {
          replace: true,
          state: { error: "Google sign-in failed. Please try again." },
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [dispatch, navigate]);

  return (
    <div className="mx-auto w-full max-w-xl rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm shadow-black/5">
      <div className="text-lg font-extrabold text-slate-900">Signing you in with Google...</div>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Please wait while we finish authentication.
      </p>
    </div>
  );
}
