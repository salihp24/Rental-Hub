import Navbar from "../Layout/Navbar";
import Sidebar from "../Layout/Sidebar";
import ProductCard from "../Products/ProductCard";

export default function Home() {
  return (
    <div className="bg-gray-100 min-h-screen">
      
      <Navbar />    

      <div className="flex">
        
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 p-6">
          
          {/* Hero Section */}
          <div className="bg-white rounded-xl p-6 mb-6 shadow">
            <h2 className="text-2xl font-bold">
              The New Standard
            </h2>
            <p className="text-gray-500">
              Discover latest gadgets
            </p>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-4 gap-6">
            {Array(8)
              .fill(0)
              .map((_, i) => (
                <ProductCard key={i} />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}