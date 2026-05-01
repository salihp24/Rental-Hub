import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Layout from "./components/Layout/Layout";
import AccountPage from "./pages/AccountPage";
import ChatPage from "./pages/ChatPage";
import HomePage from "./pages/HomePage";
import ListProductPage from "./pages/ListProductPage";
import LoginPage from "./pages/LoginPage";
import ProductBrowsePage from "./pages/ProductBrowsePage";
import RegisterPage from "./pages/RegisterPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import { fetchCurrentUser } from "./store/slices/authSlice";

function RequireAuth({ children }) {
  const { user } = useSelector((s) => s.auth);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default function App() {
  const dispatch = useDispatch();
  const { token } = useSelector((s) => s.auth);

  useEffect(() => {
    if (token) {
      dispatch(fetchCurrentUser());
    }
  }, [dispatch, token]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductBrowsePage />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
