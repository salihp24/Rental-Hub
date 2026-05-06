import Button from "../../components/ui/Button";
import { PRODUCT_STATUSES } from "./constants";

export default function ProductsSection({
  products,
  busyKey,
  onUpdateProductStatus,
  onToggleFeatured,
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4">
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
              <tr key={product._id} className="border-b border-black/5">
                <td className="py-2">{product.title}</td>
                <td className="py-2">{product.owner?.email || "-"}</td>
                <td className="py-2">
                  <select
                    className="rounded-lg border border-black/15 px-2 py-1"
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
                <td className="py-2">{product.isFeatured ? "Yes" : "No"}</td>
                <td className="py-2">
                  <Button
                    variant="secondary"
                    onClick={() => onToggleFeatured(product._id, product.isFeatured)}
                    disabled={busyKey === `product-featured-${product._id}`}
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
