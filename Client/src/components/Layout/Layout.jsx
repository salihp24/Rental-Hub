import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import CategoryMegaNav from "./CategoryMegaNav";
import Footer from "./Footer";

export default function Layout() {
  return (
    <div className="min-h-dvh bg-[#FFF7D1]">
      <Navbar />
      <CategoryMegaNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

