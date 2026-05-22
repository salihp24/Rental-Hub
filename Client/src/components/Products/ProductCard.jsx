import { Link } from "react-router-dom";
import { getPrimaryImageUrl } from "../../lib/productImages";

const money = (value, currency = "INR") => {
  const num = Number(value || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${currency} ${num}`;
  }
};

export default function ProductCard({ product }) {
  const imageUrl = getPrimaryImageUrl(product?.images);
  const title = product?.title || "Untitled";
  const productPath = product?.slug || product?._id;
  const city = product?.location?.city;
  const state = product?.location?.state;
  const price = product?.pricing?.daily?.rate;
  const currency = product?.pricing?.currency || "INR";

  return (
    <div className="group overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_10px_28px_rgba(37,99,235,0.10)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
            No image
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white">
          {product?.condition?.replaceAll("_", " ") || "good"}
        </div>
        {product?.isFeatured ? (
          <div className="absolute right-3 top-3 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
            Featured
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-slate-900">{title}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {city && state ? `${city}, ${state}` : "Nearby"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-extrabold text-blue-700">{money(price, currency)}</div>
            <div className="text-[11px] font-semibold text-slate-500">per day</div>
          </div>
        </div>

        <Link
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          to={`/products/${productPath}`}
        >
          View
        </Link>
      </div>
    </div>
  );
}
