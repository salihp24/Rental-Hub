import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import CategoryMegaNav from "./CategoryMegaNav";
import Footer from "./Footer";
import AdminTopbar from "./AdminTopbar";

export default function Layout() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div className="min-h-dvh flex flex-col">
      {isAdminRoute ? <AdminTopbar /> : <Navbar />}
      {!isAdminRoute ? <CategoryMegaNav /> : null}
      <main
        className={
          isAdminRoute
            ? "w-full px-4 py-6 md:px-6 lg:px-8 flex-1"
            : "mx-auto w-full max-w-6xl px-4 py-8 flex-1"
        }
      >
        <Outlet />
      </main>
      {!isAdminRoute ? <Footer /> : null}
    </div>
  );
}
