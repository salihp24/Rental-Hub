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
    <div className="rounded-2xl border border-blue-100 bg-white p-4">
      <div className="text-[11px] font-extrabold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

const UNIT_COPY = {
  daily: { label: "Daily", unit: "day", helper: "Best for standard short-term rentals." },
  weekly: { label: "Weekly", unit: "week", helper: "Billed in started 7-day blocks." },
};

export default function ProductDetailPage() {
  const { productSlug, productId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const isPreviewRoute = Boolean(productId);
  const identifier = productId || productSlug;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pricingUnit, setPricingUnit] = useState("daily");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDaysIso(1));
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

      const endpoint = isPreviewRoute
        ? `/products/preview/${productId}`
        : `/products/${productSlug}`;

      api
        .get(endpoint)
        .then((res) => {
          if (!alive) return;
          const nextProduct = res.data?.data?.product || null;
          setProduct(nextProduct);
          if (!isPreviewRoute && nextProduct?.slug && nextProduct.slug !== productSlug) {
            navigate(`/products/${nextProduct.slug}`, { replace: true });
          }
        })
        .catch((err) => {
          if (alive) {
            setError(err?.response?.data?.message || err.message || "We could not load this listing.");
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
  }, [isPreviewRoute, navigate, productId, productSlug]);

  const bookingProductId = product?._id || "";
  const publicProductPath = product?.slug || identifier || bookingProductId;
  const backPath = isPreviewRoute ? "/account" : "/";

  const availableUnits = useMemo(() => {
    const units = [];
    if (product?.pricing?.daily?.enabled !== false) units.push("daily");
    if (product?.pricing?.weekly?.enabled) units.push("weekly");
    return units.length ? units : ["daily"];
  }, [product]);

  const displayImages = getDisplayImages(product?.images);
  const imageUrl = getPrimaryImageUrl(product?.images);
  const currency = product?.pricing?.currency || "INR";
  const isOwner = product?.owner?._id && user?._id && product.owner._id === user._id;
  const ownerLabel = product?.owner?.name || product?.owner?.email || "Owner";
  const ownerAvatar = product?.owner?.avatar?.url || "";
  const trustedSellerState = product?.owner?.ownerProfile?.trustedSeller || {};
  const isTrustedSeller =
    trustedSellerState?.manualOverride === true ||
    (trustedSellerState?.manualOverride !== false && trustedSellerState?.autoQualified === true);
  const activePricingUnit = availableUnits.includes(pricingUnit) ? pricingUnit : availableUnits[0];
  const isReadOnlyPreview = isPreviewRoute && isOwner;

  const pricing = availability?.pricing;
  const negotiatedRate = availability?.negotiation?.amount;
  const effectiveDailyRate =
    negotiatedRate != null ? negotiatedRate : product?.pricing?.daily?.rate;
  const unitCopy = UNIT_COPY[activePricingUnit];
  const ruleText = useMemo(() => {
    const rules = product?.rentalRules;
    if (!rules) return "Rental rules unavailable";
    return `${rules.minRentalDays || 1}-${rules.maxRentalDays || 30} days, ${rules.advanceBookingDays || 0} days ahead`;
  }, [product]);

  const activeStart = startDate;
  const activeEnd = endDate;
  const ownerMemberSince = product?.owner?.createdAt
    ? new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(
        new Date(product.owner.createdAt)
      )
    : null;

  const updateDeliveryAddress = (field, value) => {
    setDeliveryAddress((current) => ({ ...current, [field]: value }));
  };

  const buildBookingWindow = () => ({
    startDate,
    endDate,
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
      setError(err?.response?.data?.message || err.message || "We could not check availability.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!bookingProductId) return;

    const timer = window.setTimeout(async () => {
      try {
        const windowPayload = {
          startDate,
          endDate,
        };
        const res = await api.get("/bookings/availability", {
          params: {
            product: bookingProductId,
            pricingUnit: activePricingUnit,
            ...windowPayload,
          },
        });
        setAvailability(res.data?.data || null);
      } catch {
        // Silent preload: keep base price if availability check fails.
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [bookingProductId, activePricingUnit, startDate, endDate]);

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
      setError("A delivery address is required for delivery requests.");
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
        `Your booking request has been submitted${createdBooking?.orderCode ? ` (${createdBooking.orderCode})` : ""}. After the owner approves it, you can complete payment from your account page.`
      );
      setAvailability(null);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "We could not submit your booking request.");
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
    const windowPayload = buildBookingWindow();
    const params = new URLSearchParams({
      product: product._id,
      participant: product.owner._id,
      pricingUnit: activePricingUnit,
      startDate: windowPayload.startDate,
      endDate: windowPayload.endDate,
    });
    navigate(`/chat?${params.toString()}`);
  };

  if (!identifier) return <Navigate to="/" replace />;

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
      <Button variant="ghost" as={Link} to={backPath}>
        Back to Listings
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
        <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm shadow-black/5">
          <div className="aspect-[4/3] bg-blue-50/60">
            {imageUrl ? (
              <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-900/40">
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
            <div className="text-xs font-extrabold uppercase text-slate-500">
              {product.category?.name || "Product"}
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              {product.title}
            </h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
              {product.description}
            </p>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-white p-4 shadow-sm shadow-black/5">
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-blue-200 bg-blue-50">
                {ownerAvatar ? (
                  <img src={ownerAvatar} alt={ownerLabel} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-extrabold text-blue-700">
                    {ownerLabel.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Posted by</div>
                <div className="truncate text-xl font-extrabold text-slate-900">{ownerLabel}</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  {ownerMemberSince ? `Member since ${ownerMemberSince}` : "Verified marketplace member"}
                </div>
                {isTrustedSeller ? (
                  <div className="mt-2 inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-extrabold text-white">
                    Trusted Seller
                  </div>
                ) : (
                  <div className="mt-2 inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                    Seller
                  </div>
                )}
              </div>
            </div>

            {!isOwner && !isReadOnlyPreview ? (
              <div className="mt-4 space-y-3">
                <Button type="button" variant="secondary" className="w-full" onClick={openChat}>
                  Chat with seller
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoRow
              label={negotiatedRate != null ? "Your special rate" : "Daily rate"}
              value={`${money(effectiveDailyRate, currency)} / day`}
            />
            <InfoRow label="Deposit" value={money(product.pricing?.deposit, currency)} />
            <InfoRow label="Location" value={`${product.location?.city || "Nearby"}, ${product.location?.state || ""}`} />
            <InfoRow label="Rental rules" value={ruleText} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoRow label="Daily" value={`${money(effectiveDailyRate, currency)} / day`} />
            {product.pricing?.weekly?.enabled ? (
              <InfoRow label="Weekly" value={`${money(product.pricing.weekly.rate, currency)} / week`} />
            ) : null}
          </div>

          {!isReadOnlyPreview ? (
            <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm shadow-black/5">
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-slate-900">Request Booking</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Choose a pricing option, check availability, review charges, and submit your request.
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
                      ? "border-blue-300 bg-blue-50"
                      : "border-blue-100 hover:border-blue-200"
                  }`}
                >
                  <div className="text-sm font-extrabold text-slate-900">{UNIT_COPY[unit].label}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-600">
                    {UNIT_COPY[unit].helper}
                  </div>
                </button>
              ))}
            </div>

            <form className="grid gap-4 sm:grid-cols-2" onSubmit={checkAvailability}>
              <>
                <label className="space-y-2">
                  <span className="text-xs font-extrabold text-slate-700">Start date</span>
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
                  <span className="text-xs font-extrabold text-slate-700">End date</span>
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
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full" disabled={checking}>
                  {checking ? "Checking availability..." : `Check ${unitCopy.label.toLowerCase()} availability`}
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
                    : "The selected dates are unavailable"}
                </div>

                {pricing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoRow
                        label={`${pricing.unitLabel || unitCopy.unit} rate`}
                        value={`${money(pricing.baseRate, currency)} / ${pricing.unitLabel || unitCopy.unit}`}
                      />
                      <InfoRow
                        label="Duration"
                        value={
                          activePricingUnit === "weekly"
                            ? `${availability.totalUnits} weeks for ${availability.totalDays} days`
                            : `${availability.totalDays} days`
                        }
                      />
                      <InfoRow label="Rental" value={money(pricing.rentalAmount, currency)} />
                      <InfoRow label="Total" value={money(pricing.totalAmount, currency)} />
                    </div>
                    {pricing.appliedSlab && Number(pricing.discountAmount) > 0 ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                        Offer applied: {Number(pricing.appliedSlab.discountPercent)}% off for{" "}
                        {pricing.appliedSlab.minDays}-{pricing.appliedSlab.maxDays} day rentals.
                        You save {money(pricing.discountAmount, currency)} on this booking.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {availability?.negotiation?.amount != null ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    Special price applied:{" "}
                    {money(availability.negotiation.amount, availability.negotiation.currency || currency)} per day.
                  </div>
                ) : null}

                <label className="block space-y-2">
                  <span className="text-xs font-extrabold text-slate-700">Delivery</span>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    className="w-full rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
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
                  placeholder="Add pickup details, accessory requirements, or questions for the owner."
                />

                {isOwner ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm font-semibold text-slate-600">
                    You are the owner of this listing.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!availability.available || booking || isOwner}
                      onClick={createBooking}
                    >
                      {!user ? "Sign In to Book" : booking ? "Submitting..." : "Submit Request"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={openChat}
                    >
                      {!user ? "Sign In to Contact Owner" : "Message Owner"}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 text-xs font-semibold text-slate-500">
              Selected time window: {activeStart} to {activeEnd}
            </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm font-semibold text-slate-700">
              Owner preview mode: booking actions are hidden until this listing is approved.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
