export default function Sidebar() {
  const categories = [
    "Electronics",
    "Mobiles",
    "Laptops",
    "Accessories",
    "Gaming",
    "Cameras",
  ];

  return (
    <div className="w-64 bg-white shadow h-screen p-4">
      <h2 className="font-semibold mb-4">All Categories</h2>

      <ul className="space-y-3">
        {categories.map((cat, i) => (
          <li
            key={i}
            className="cursor-pointer hover:text-primary"
          >
            {cat}
          </li>
        ))}
      </ul>
    </div>
  );
}