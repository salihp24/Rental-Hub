import Button from "../ui/Button";

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
  const imageUrl = product?.images?.[0]?.url;
  const title = product?.title || "Untitled";
  const city = product?.location?.city;
  const state = product?.location?.state;
  const price = product?.pricing?.daily?.rate;
  const currency = product?.pricing?.currency || "INR";

  return (
    <div className="group overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm shadow-black/5">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/[0.03]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-black/40">
            No image
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-bold text-white">
          {product?.condition?.replaceAll("_", " ") || "good"}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-black">
              {title}
            </div>
            <div className="mt-1 text-xs font-semibold text-black/55">
              {city && state ? `${city}, ${state}` : "Nearby"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-extrabold text-black">
              {money(price, currency)}
            </div>
            <div className="text-[11px] font-semibold text-black/50">per day</div>
          </div>
        </div>

        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => {}}
        >
          View
        </Button>
      </div>
    </div>
  );
}