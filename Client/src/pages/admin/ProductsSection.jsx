import Button from "../../components/ui/Button";
import { PRODUCT_STATUSES } from "./constants";
import { badgeClassByStatus, cardClass } from "./ui.jsx";

export default function ProductsSection({
  products,
  busyKey,
  onUpdateProductStatus,
  onToggleFeatured,
}) {
  return (
    <section className={`p-4 ${cardClass}`}>
      <h2 className="mb-3 text-lg font-extrabold">Products</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/60">
              <th className="py-2">Title</th>
              <th className="py-2">Owner</th>
              <th className="py-2">Status</th>
              <th className="py-2">Featured</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id} className="border-b border-black/5 transition hover:bg-black/[0.02]">
                <td className="py-2">{product.title}</td>
                <td className="py-2">{product.owner?.email || "-"}</td>
                <td className="py-2">
                  <span className={`mr-2 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassByStatus(product.status)}`}>
                    {product.status}
                  </span>
                  <select
                    className="rounded-lg border border-black/15 px-2 py-1 transition hover:border-black/30"
                    value={product.status}
                    onChange={(e) => onUpdateProductStatus(product._id, e.target.value)}
                    disabled={busyKey === `product-status-${product._id}`}
                  >
                    {PRODUCT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product.isFeatured ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"}`}>
                    {product.isFeatured ? "Featured" : "Normal"}
                  </span>
                </td>
                <td className="py-2">
                  <Button
                    variant="secondary"
                    onClick={() => onToggleFeatured(product._id, product.isFeatured)}
                    disabled={busyKey === `product-featured-${product._id}`}
                    className="shadow-sm hover:shadow"
                  >
                    {product.isFeatured ? "Unfeature" : "Feature"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
