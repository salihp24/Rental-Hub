import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Layout from "./components/Layout/Layout";
import AccountPage from "./pages/AccountPage";
import ChatPage from "./pages/ChatPage";
import HomePage from "./pages/HomePage";
import ListProductPage from "./pages/ListProductPage";
import LoginPage from "./pages/LoginPage";
import GoogleAuthCallbackPage from "./pages/GoogleAuthCallbackPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ProductBrowsePage from "./pages/ProductBrowsePage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminBookingsPage from "./pages/admin/AdminBookingsPage";
import AdminFinancePage from "./pages/admin/AdminFinancePage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import { fetchCurrentUser } from "./store/slices/authSlice";

function RequireAuth({ children }) {
  const { user } = useSelector((s) => s.auth);
  const location = useLocation();
  const isBootstrappingAuth = useSelector((s) => s.auth.isBootstrapping);

  if (isBootstrappingAuth) {
    return <div className="p-6 text-sm font-semibold text-slate-600">Checking account...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function RequireAdmin({ children }) {
  const { user } = useSelector((s) => s.auth);
  const location = useLocation();
  const isBootstrappingAuth = useSelector((s) => s.auth.isBootstrapping);

  if (isBootstrappingAuth) {
    return <div className="p-6 text-sm font-semibold text-slate-600">Checking account...</div>;
  }

  if (!user?.role?.includes("admin")) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default function App() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const bootstrappingStartedRef = useRef(false);

  useEffect(() => {
    if (bootstrappingStartedRef.current) return;
    bootstrappingStartedRef.current = true;

    if (!user) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, user]);

  return (
    <Routes>
      <Route path="admin/login" element={<AdminLoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductBrowsePage />} />
        <Route
          path="owner/listings/:productId/preview"
          element={
            <RequireAuth>
              <ProductDetailPage />
            </RequireAuth>
          }
        />
        <Route path="products/:productSlug" element={<ProductDetailPage />} />
        <Route
          path="chat"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route
          path="products/:productId/edit"
          element={
            <RequireAuth>
              <ListProductPage />
            </RequireAuth>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="auth/google/callback" element={<GoogleAuthCallbackPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="list"
          element={
            <RequireAuth>
              <ListProductPage />
            </RequireAuth>
          }
        />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="finance" element={<AdminFinancePage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
