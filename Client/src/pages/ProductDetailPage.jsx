import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../lib/api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import {
  getDisplayImages,
  getImageUrl,
  getPrimaryImageUrl,
} from "../lib/productImages";

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDaysIso = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const toLocalDateTimeValue = (date) => {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 16);
};

const addHoursLocalValue = (hours) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 5);
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hours);
  return toLocalDateTimeValue(date);
};

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

function InfoRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="text-[11px] font-extrabold uppercase text-black/45">{label}</div>
      <div className="mt-1 text-sm font-extrabold text-black">{value}</div>
    </div>
  );
}

const UNIT_COPY = {
  hourly: { label: "Hourly", unit: "hour", helper: "Use exact start and end times." },
  daily: { label: "Daily", unit: "day", helper: "Best for standard short-term rentals." },
  weekly: { label: "Weekly", unit: "week", helper: "Billed in started 7-day blocks." },
};

export default function ProductDetailPage() {
  const { productSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pricingUnit, setPricingUnit] = useState("daily");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDaysIso(1));
  const [startDateTime, setStartDateTime] = useState(addHoursLocalValue(1));
  const [endDateTime, setEndDateTime] = useState(addHoursLocalValue(3));
  const [deliveryType, setDeliveryType] = useState("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [renterNote, setRenterNote] = useState("");
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [booking, setBooking] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");

      api
        .get(`/products/${productSlug}`)
        .then((res) => {
          if (!alive) return;
          const nextProduct = res.data?.data?.product || null;
          setProduct(nextProduct);
          if (nextProduct?.slug && nextProduct.slug !== productSlug) {
            navigate(`/products/${nextProduct.slug}`, { replace: true });
          }
        })
        .catch((err) => {
          if (alive) {
            setError(err?.response?.data?.message || err.message || "Could not load product.");
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [navigate, productSlug]);

  const bookingProductId = product?._id || "";
  const publicProductPath = product?.slug || productSlug || bookingProductId;

  const availableUnits = useMemo(() => {
    const units = [];
    if (product?.pricing?.hourly?.enabled) units.push("hourly");
    if (product?.pricing?.daily?.enabled !== false) units.push("daily");
    if (product?.pricing?.weekly?.enabled) units.push("weekly");
    return units.length ? units : ["daily"];
  }, [product]);

  const displayImages = getDisplayImages(product?.images);
  const imageUrl = getPrimaryImageUrl(product?.images);
  const currency = product?.pricing?.currency || "INR";
  const isOwner = product?.owner?._id && user?._id && product.owner._id === user._id;
  const activePricingUnit = availableUnits.includes(pricingUnit) ? pricingUnit : availableUnits[0];

  const pricing = availability?.pricing;
  const unitCopy = UNIT_COPY[activePricingUnit];
  const ruleText = useMemo(() => {
    const rules = product?.rentalRules;
    if (!rules) return "Rules unavailable";
    return `${rules.minRentalDays || 1}-${rules.maxRentalDays || 30} days, ${rules.advanceBookingDays || 0} days ahead`;
  }, [product]);

  const activeStart = activePricingUnit === "hourly" ? startDateTime : startDate;
  const activeEnd = activePricingUnit === "hourly" ? endDateTime : endDate;

  const updateDeliveryAddress = (field, value) => {
    setDeliveryAddress((current) => ({ ...current, [field]: value }));
  };

  const buildBookingWindow = () => ({
    startDate: activePricingUnit === "hourly" ? new Date(startDateTime).toISOString() : startDate,
    endDate: activePricingUnit === "hourly" ? new Date(endDateTime).toISOString() : endDate,
  });

  const checkAvailability = async (e) => {
    e.preventDefault();
    setNotice("");
    setAvailability(null);
    setChecking(true);
    setError("");

    try {
      const windowPayload = buildBookingWindow();
      const res = await api.get("/bookings/availability", {
        params: { product: bookingProductId, pricingUnit: activePricingUnit, ...windowPayload },
      });
      setAvailability(res.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not check availability.");
    } finally {
      setChecking(false);
    }
  };

  const createBooking = async () => {
    if (!user) {
      navigate("/login", { state: { from: `/products/${publicProductPath}` } });
      return;
    }

    setBooking(true);
    setError("");
    setNotice("");

    if (
      deliveryType === "delivery" &&
      (!deliveryAddress.street.trim() ||
        !deliveryAddress.city.trim() ||
        !deliveryAddress.state.trim() ||
        !deliveryAddress.pincode.trim())
    ) {
      setBooking(false);
      setError("Delivery address is required for delivery bookings.");
      return;
    }

    const payload = {
      product: bookingProductId,
      pricingUnit: activePricingUnit,
      ...buildBookingWindow(),
      deliveryType,
      renterNote,
    };

    if (deliveryType === "delivery") {
      payload.deliveryAddress = deliveryAddress;
    }

    try {
      const res = await api.post("/bookings", payload);
      const createdBooking = res.data?.data?.booking;
      setNotice(
        `Booking request submitted${createdBooking?.orderCode ? ` (${createdBooking.orderCode})` : ""}. Wait for the owner to approve it, then you can pay from your account page.`
      );
      setAvailability(null);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not create booking.");
    } finally {
      setBooking(false);
    }
  };

  const openChat = () => {
    if (!user) {
      navigate("/login", { state: { from: `/products/${publicProductPath}` } });
      return;
    }

    if (!product?.owner?._id || isOwner) return;

    navigate(`/chat?product=${product._id}&participant=${product.owner._id}`);
  };

  if (!productSlug) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="h-[420px] animate-pulse rounded-3xl bg-white" />
        <div className="h-[420px] animate-pulse rounded-3xl bg-white" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm font-semibold text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" as={Link} to="/">
        Back to listings
      </Button>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm shadow-black/5">
          <div className="aspect-[4/3] bg-black/[0.03]">
            {imageUrl ? (
              <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-black/40">
                No image
              </div>
            )}
          </div>
          {displayImages.length > 1 ? (
            <div className="grid grid-cols-4 gap-2 p-3">
              {displayImages.slice(1, 5).map((img) => (
                <img
                  key={img.publicId || img.url}
                  src={getImageUrl(img)}
                  alt=""
                  className="aspect-square rounded-2xl object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div>
            <div className="text-xs font-extrabold uppercase text-black/45">
              {product.category?.name || "Product"}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-black">
              {product.title}
            </h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-black/60">
              {product.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Daily rate" value={`${money(product.pricing?.daily?.rate, currency)} / day`} />
            <InfoRow label="Deposit" value={money(product.pricing?.deposit, currency)} />
            <InfoRow label="Location" value={`${product.location?.city || "Nearby"}, ${product.location?.state || ""}`} />
            <InfoRow label="Rental rules" value={ruleText} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {product.pricing?.hourly?.enabled ? (
              <InfoRow label="Hourly" value={`${money(product.pricing.hourly.rate, currency)} / hour`} />
            ) : null}
            <InfoRow label="Daily" value={`${money(product.pricing?.daily?.rate, currency)} / day`} />
            {product.pricing?.weekly?.enabled ? (
              <InfoRow label="Weekly" value={`${money(product.pricing.weekly.rate, currency)} / week`} />
            ) : null}
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm shadow-black/5">
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-black">Request a booking</h2>
              <p className="mt-1 text-sm font-semibold text-black/55">
                Choose a pricing mode, check availability, review pricing, and send your booking request.
              </p>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {availableUnits.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => {
                    setPricingUnit(unit);
                    setAvailability(null);
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    activePricingUnit === unit
                      ? "border-black bg-[#FFF7D1]"
                      : "border-black/10 hover:border-black/20"
                  }`}
                >
                  <div className="text-sm font-extrabold text-black">{UNIT_COPY[unit].label}</div>
                  <div className="mt-1 text-xs font-semibold text-black/55">
                    {UNIT_COPY[unit].helper}
                  </div>
                </button>
              ))}
            </div>

            <form className="grid gap-4 sm:grid-cols-2" onSubmit={checkAvailability}>
              {activePricingUnit === "hourly" ? (
                <>
                  <label className="space-y-2">
                    <span className="text-xs font-extrabold text-black/70">Start time</span>
                    <Input
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => {
                        setStartDateTime(e.target.value);
                        setAvailability(null);
                      }}
                      required
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-extrabold text-black/70">End time</span>
                    <Input
                      type="datetime-local"
                      value={endDateTime}
                      min={startDateTime}
                      onChange={(e) => {
                        setEndDateTime(e.target.value);
                        setAvailability(null);
                      }}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="space-y-2">
                    <span className="text-xs font-extrabold text-black/70">Start date</span>
                    <Input
                      type="date"
                      min={todayIso()}
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setAvailability(null);
                      }}
                      required
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-extrabold text-black/70">End date</span>
                    <Input
                      type="date"
                      min={startDate}
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setAvailability(null);
                      }}
                      required
                    />
                  </label>
                </>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full" disabled={checking}>
                  {checking ? "Checking..." : `Check ${unitCopy.label.toLowerCase()} availability`}
                </Button>
              </div>
            </form>

            {availability ? (
              <div className="mt-5 space-y-4">
                <div className={`rounded-2xl border px-4 py-3 text-sm font-extrabold ${
                  availability.available
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}>
                  {availability.available
                    ? `${availability.totalUnits} ${availability.pricing?.unitLabel || unitCopy.unit}${Number(availability.totalUnits) === 1 ? "" : "s"} available`
                    : "Those dates are not available"}
                </div>

                {pricing ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <InfoRow
                      label={`${pricing.unitLabel || unitCopy.unit} rate`}
                      value={`${money(pricing.baseRate, currency)} / ${pricing.unitLabel || unitCopy.unit}`}
                    />
                    <InfoRow
                      label="Duration"
                      value={
                        activePricingUnit === "hourly"
                          ? `${availability.totalHours} hours`
                          : activePricingUnit === "weekly"
                            ? `${availability.totalUnits} weeks for ${availability.totalDays} days`
                            : `${availability.totalDays} days`
                      }
                    />
                    <InfoRow label="Rental" value={money(pricing.rentalAmount, currency)} />
                    <InfoRow label="Total" value={money(pricing.totalAmount, currency)} />
                  </div>
                ) : null}

                <label className="block space-y-2">
                  <span className="text-xs font-extrabold text-black/70">Delivery</span>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-black/25 focus:ring-2 focus:ring-black/10"
                  >
                    <option value="pickup">Pickup</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </label>

                {deliveryType === "delivery" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Street" value={deliveryAddress.street} onChange={(e) => updateDeliveryAddress("street", e.target.value)} required />
                    <Input placeholder="City" value={deliveryAddress.city} onChange={(e) => updateDeliveryAddress("city", e.target.value)} required />
                    <Input placeholder="State" value={deliveryAddress.state} onChange={(e) => updateDeliveryAddress("state", e.target.value)} required />
                    <Input placeholder="Pincode" value={deliveryAddress.pincode} onChange={(e) => updateDeliveryAddress("pincode", e.target.value)} required />
                  </div>
                ) : null}

                <Textarea
                  value={renterNote}
                  onChange={(e) => setRenterNote(e.target.value)}
                  maxLength={500}
                  placeholder="Add pickup timing, accessory needs, or questions for the owner."
                />

                {isOwner ? (
                  <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-semibold text-black/60">
                    You own this listing.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!availability.available || booking || isOwner}
                      onClick={createBooking}
                    >
                      {!user ? "Login to book" : booking ? "Sending..." : "Book now"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={openChat}
                    >
                      {!user ? "Login to message" : "Message owner"}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 text-xs font-semibold text-black/45">
              Selected window: {activeStart} to {activeEnd}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
