import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../lib/api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import {
  clearAuthError,
  updateOwnerProfile,
  updatePassword,
  updateProfile,
} from "../store/slices/authSlice";
import { getPrimaryImageUrl } from "../lib/productImages";

const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";

const emptyAddress = {
  street: "",
  city: "",
  state: "",
  pincode: "",
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

const formatDate = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay checkout.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_URL;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(script);
  });

function StatusPill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-black/[0.06] text-black/65",
    payment: "bg-[#FFF7D1] text-black/70",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-extrabold text-black/70">{label}</span>
      {children}
    </label>
  );
}

function BookingCard({ booking, mode, onAction, busyId }) {
  const product = booking.product || {};
  const party = mode === "owner" ? booking.renter : booking.owner;
  const currency = booking.pricingSnapshot?.currency || product.pricing?.currency || "INR";
  const busy = busyId === booking._id;
  const canOwnerDecide = mode === "owner" && booking.status === "pending";
  const canOwnerStartRental =
    mode === "owner" &&
    booking.status === "confirmed" &&
    booking.paymentStatus === "paid";
  const canOwnerConfirmReturn = mode === "owner" && booking.status === "return_requested";
  const canCancel = mode === "renter" && ["pending", "confirmed"].includes(booking.status);
  const canConfirmPayment =
    mode === "renter" &&
    booking.status === "confirmed" &&
    booking.paymentStatus === "unpaid";
  const canRequestReturn = mode === "renter" && booking.status === "active";
  const unitLabel = booking.pricingUnit === "hourly" ? "hours" : booking.pricingUnit === "weekly" ? "weeks" : "days";
  const durationLabel =
    booking.pricingUnit === "hourly"
      ? `${booking.totalUnits} ${unitLabel}`
      : booking.pricingUnit === "weekly"
        ? `${booking.totalUnits} ${unitLabel} | ${booking.totalDays} days`
        : `${booking.totalDays} ${unitLabel}`;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm shadow-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-black">
            {product.title || "Booked product"}
          </div>
          <div className="mt-1 text-xs font-semibold text-black/55">
            {booking.pricingUnit === "hourly"
              ? `${formatDateTime(booking.startDate)} to ${formatDateTime(booking.endDate)} | ${durationLabel}`
              : `${formatDate(booking.startDate)} to ${formatDate(booking.endDate)} | ${durationLabel}`}
          </div>
          <div className="mt-1 text-xs font-semibold text-black/45">
            Order: {booking.orderCode || "-"}
          </div>
          <div className="mt-1 text-xs font-semibold text-black/45">
            {mode === "owner" ? "Renter" : "Owner"}: {party?.name || party?.email || "Unknown"}
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-extrabold text-black">
            {money(booking.pricingSnapshot?.totalAmount, currency)}
          </div>
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            <StatusPill>{booking.status}</StatusPill>
            <StatusPill tone="payment">{booking.paymentStatus}</StatusPill>
          </div>
        </div>
      </div>

      {booking.renterNote ? (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2 text-xs font-semibold text-black/60">
          {booking.renterNote}
        </div>
      ) : null}

      {booking.paymentDetails?.confirmedAt ? (
        <div className="mt-3 rounded-xl bg-[#FFF7D1]/50 px-3 py-2 text-xs font-semibold text-black/65">
          Payment confirmed on {formatDate(booking.paymentDetails.confirmedAt)}
          {booking.paymentDetails.reference ? ` (${booking.paymentDetails.reference})` : ""}
        </div>
      ) : null}

      {booking.cancellation?.cancelledAt ? (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2 text-xs font-semibold text-black/60">
          Cancelled on {formatDate(booking.cancellation.cancelledAt)}
          {booking.cancellation.refundAmount
            ? ` | Refund ${money(booking.cancellation.refundAmount, currency)}`
            : ""}
        </div>
      ) : null}

      {booking.paymentDetails?.refundStatus ? (
        <div className="mt-3 rounded-xl bg-[#FFF7D1]/50 px-3 py-2 text-xs font-semibold text-black/65">
          Refund status: {booking.paymentDetails.refundStatus}
          {booking.paymentDetails.refundAmount
            ? ` | ${money(booking.paymentDetails.refundAmount, currency)}`
            : ""}
        </div>
      ) : null}

      {booking.returnFlow?.requestedAt ? (
        <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2 text-xs font-semibold text-black/60">
          Return requested on {formatDateTime(booking.returnFlow.requestedAt)}
          {booking.returnFlow?.confirmedAt
            ? ` | Confirmed on ${formatDateTime(booking.returnFlow.confirmedAt)}`
            : ""}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canConfirmPayment ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() => onAction(booking._id, "confirmPayment", {})}
          >
            Pay now
          </Button>
        ) : null}

        {canOwnerDecide ? (
          <>
            <Button
              type="button"
              disabled={busy}
              onClick={() => onAction(booking._id, "status", { status: "confirmed" })}
            >
              Confirm
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                onAction(booking._id, "status", {
                  status: "rejected",
                  reason: "Rejected from owner account page.",
                })
              }
            >
              Reject
            </Button>
          </>
        ) : null}

        {canOwnerStartRental ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              onAction(booking._id, "status", {
                status: "active",
              })
            }
          >
            Mark active
          </Button>
        ) : null}

        {canOwnerConfirmReturn ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              onAction(booking._id, "status", {
                status: "completed",
              })
            }
          >
            Confirm return
          </Button>
        ) : null}

        {canRequestReturn ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              onAction(booking._id, "status", {
                status: "return_requested",
              })
            }
          >
            Request return
          </Button>
        ) : null}

        {canCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              onAction(booking._id, "cancel", {
                reason: "Cancelled from account page.",
              })
            }
          >
            Cancel
          </Button>
        ) : null}

        <Button variant="secondary" as={Link} to={`/chat?booking=${booking._id}`}>
          Open chat
        </Button>
      </div>

      {mode === "renter" && booking.status === "pending" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          Waiting for owner approval before payment.
        </div>
      ) : null}

      {mode === "renter" && booking.status === "confirmed" && booking.paymentStatus !== "paid" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          Approved by owner. Complete payment to lock in the booking.
        </div>
      ) : null}

      {mode === "owner" && booking.status === "pending" && booking.paymentStatus !== "paid" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          Approve this request to reserve the dates and ask the renter for payment.
        </div>
      ) : null}

      {mode === "owner" && booking.status === "confirmed" && booking.paymentStatus !== "paid" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          Approved. Waiting for renter payment.
        </div>
      ) : null}

      {mode === "owner" && booking.status === "confirmed" && booking.paymentStatus === "paid" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          Payment is complete. You can now mark this rental as active when the handoff starts.
        </div>
      ) : null}

      {mode === "renter" && booking.status === "active" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          The rental is in progress. Request a return once you hand the item back.
        </div>
      ) : null}

      {mode === "renter" && booking.status === "return_requested" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          Return requested. Waiting for the owner to confirm the item was received back.
        </div>
      ) : null}

      {mode === "owner" && booking.status === "active" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          Rental is active. The renter will request a return once the item is handed back.
        </div>
      ) : null}

      {mode === "owner" && booking.status === "return_requested" ? (
        <div className="mt-3 text-xs font-semibold text-black/50">
          The renter says the product has been returned. Confirm it after inspection or handoff.
        </div>
      ) : null}
    </div>
  );
}

function BookingPanel({ title, description, bookings, loading, mode, onAction, busyId }) {
  return (
    <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm shadow-black/5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-black">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-black/55">{description}</p>
        </div>
        <StatusPill>{bookings.length}</StatusPill>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : bookings.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {bookings.map((booking) => (
            <BookingCard
              key={booking._id}
              booking={booking}
              mode={mode}
              busyId={busyId}
              onAction={onAction}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-6 text-sm font-semibold text-black/50">
          No bookings here yet.
        </div>
      )}
    </section>
  );
}

function ListingCard({ listing, onDelete, deletingId }) {
  const imageUrl = getPrimaryImageUrl(listing.images);
  const busy = deletingId === listing._id;
  const publicProductPath = listing.slug || listing._id;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm shadow-black/5">
      <div className="aspect-[4/3] bg-black/[0.03]">
        {imageUrl ? (
          <img src={imageUrl} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-black/40">
            No image
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-black">{listing.title}</div>
            <div className="mt-1 text-xs font-semibold text-black/55">
              {listing.location?.city || "Nearby"}, {listing.location?.state || ""}
            </div>
          </div>
          <StatusPill>{listing.status}</StatusPill>
        </div>

        <div className="text-sm font-extrabold text-black">
          {money(listing.pricing?.daily?.rate, listing.pricing?.currency)} / day
        </div>

        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={`/products/${listing._id}/edit`}>
            Edit
          </Button>
          <Button variant="secondary" as={Link} to={`/products/${publicProductPath}`}>
            View
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onDelete(listing)}>
            {busy ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const dispatch = useDispatch();
  const { user, status, error } = useSelector((s) => s.auth);
  const isLoading = status === "loading";

  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [ownerProfileForm, setOwnerProfileForm] = useState({
    bio: user?.ownerProfile?.bio || "",
    address: {
      ...emptyAddress,
      ...(user?.ownerProfile?.address || {}),
    },
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [notice, setNotice] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [busyBookingId, setBusyBookingId] = useState("");
  const [deletingListingId, setDeletingListingId] = useState("");
  const [renterBookings, setRenterBookings] = useState([]);
  const [ownerBookings, setOwnerBookings] = useState([]);
  const [myListings, setMyListings] = useState([]);

  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile({
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
      });
      setOwnerProfileForm({
        bio: user?.ownerProfile?.bio || "",
        address: {
          ...emptyAddress,
          ...(user?.ownerProfile?.address || {}),
        },
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user]);

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingError("");

    try {
      const [renterRes, ownerRes] = await Promise.all([
        api.get("/bookings/mine", { params: { as: "renter", limit: 20 } }),
        api.get("/bookings/mine", { params: { as: "owner", limit: 20 } }),
      ]);

      setRenterBookings(renterRes.data?.data?.bookings || []);
      setOwnerBookings(ownerRes.data?.data?.bookings || []);
    } catch (err) {
      setBookingError(err?.response?.data?.message || err.message || "Could not load bookings.");
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  const loadListings = useCallback(async () => {
    setListingsLoading(true);
    setBookingError("");

    try {
      const res = await api.get("/products/mine", { params: { limit: 20 } });
      setMyListings(res.data?.data?.products || []);
    } catch (err) {
      setBookingError(err?.response?.data?.message || err.message || "Could not load listings.");
    } finally {
      setListingsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBookings();
      loadListings();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBookings, loadListings]);

  const listingCountLabel = useMemo(() => myListings.length, [myListings.length]);

  const handleBookingAction = async (bookingId, action, payload) => {
    setBusyBookingId(bookingId);
    setBookingError("");
    setNotice("");

    try {
      if (action === "status") {
        await api.patch(`/bookings/${bookingId}/status`, payload);
      } else if (action === "confirmPayment") {
        const Razorpay = await loadRazorpayScript();
        if (!Razorpay) {
          throw new Error("Razorpay checkout is unavailable.");
        }

        const orderRes = await api.post(`/bookings/${bookingId}/create-payment-order`);
        const checkout = orderRes.data?.data?.razorpay;

        if (!checkout?.orderId || !checkout?.keyId) {
          throw new Error("Could not initialize Razorpay payment.");
        }

        await new Promise((resolve, reject) => {
          const instance = new Razorpay({
            key: checkout.keyId,
            amount: checkout.amount,
            currency: checkout.currency,
            name: checkout.name,
            description: checkout.description,
            order_id: checkout.orderId,
            prefill: checkout.prefill,
            notes: checkout.notes,
            handler: async (response) => {
              try {
                await api.post(`/bookings/${bookingId}/verify-payment`, response);
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            modal: {
              ondismiss: () => reject(new Error("Payment was cancelled.")),
            },
            theme: {
              color: "#111111",
            },
          });

          instance.open();
        });
      } else {
        await api.post(`/bookings/${bookingId}/cancel`, payload);
      }

      setNotice(action === "confirmPayment" ? "Payment completed." : "Booking updated.");
      await loadBookings();
    } catch (err) {
      setBookingError(err?.response?.data?.message || err.message || "Could not update booking.");
    } finally {
      setBusyBookingId("");
    }
  };

  const handleDeleteListing = async (listing) => {
    const confirmed = window.confirm(`Delete "${listing.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingListingId(listing._id);
    setBookingError("");
    setNotice("");

    try {
      await api.delete(`/products/${listing._id}`);
      setNotice("Listing deleted.");
      await Promise.all([loadListings(), loadBookings()]);
    } catch (err) {
      setBookingError(err?.response?.data?.message || err.message || "Could not delete listing.");
    } finally {
      setDeletingListingId("");
    }
  };

  const setProfileField = (field, value) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const setOwnerField = (field, value) => {
    setOwnerProfileForm((current) => ({ ...current, [field]: value }));
  };

  const setOwnerAddressField = (field, value) => {
    setOwnerProfileForm((current) => ({
      ...current,
      address: {
        ...current.address,
        [field]: value,
      },
    }));
  };

  const setPasswordField = (field, value) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setNotice("");
    const result = await dispatch(updateProfile(profile));
    if (updateProfile.fulfilled.match(result)) {
      setNotice("Profile updated.");
    }
  };

  const submitOwnerProfile = async (e) => {
    e.preventDefault();
    setNotice("");
    const result = await dispatch(updateOwnerProfile({ ownerProfile: ownerProfileForm }));
    if (updateOwnerProfile.fulfilled.match(result)) {
      setNotice("Owner profile updated.");
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setNotice("");
    const result = await dispatch(updatePassword(passwordForm));
    if (updatePassword.fulfilled.match(result)) {
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setNotice("Password updated.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-black">Account</h1>
        <p className="mt-1 text-sm font-semibold text-black/55">
          Manage your profile, listings, bookings, and messages.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
        </div>
      ) : null}

      {bookingError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {bookingError}
        </div>
      ) : null}

      <BookingPanel
        title="My bookings"
        description="Review the rental requests you have placed and track their status."
        bookings={renterBookings}
        loading={bookingsLoading}
        mode="renter"
        busyId={busyBookingId}
        onAction={handleBookingAction}
      />

      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm shadow-black/5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-black">My listings</h2>
            <p className="mt-1 text-sm font-semibold text-black/55">
              Review and update the products you have published.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill>{listingCountLabel}</StatusPill>
            <Button as={Link} to="/list">
              Add listing
            </Button>
          </div>
        </div>

        {listingsLoading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-black/[0.04]" />
            ))}
          </div>
        ) : myListings.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myListings.map((listing) => (
              <ListingCard
                key={listing._id}
                listing={listing}
                deletingId={deletingListingId}
                onDelete={handleDeleteListing}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-6 text-sm font-semibold text-black/50">
            No listings yet. Add a product to start receiving rental requests.
          </div>
        )}
      </section>

      <BookingPanel
        title="Booking requests"
        description="Review incoming booking requests for your listed products."
        bookings={ownerBookings}
        loading={bookingsLoading}
        mode="owner"
        busyId={busyBookingId}
        onAction={handleBookingAction}
      />

      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm shadow-black/5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-black">Profile</h2>
            <p className="mt-1 text-sm font-semibold text-black/55">
              Update your basic account information.
            </p>
          </div>
          <div className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-bold text-black/60">
            {user?.role?.join(", ") || "renter"}
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-3" onSubmit={submitProfile}>
          <Field label="Name">
            <Input
              value={profile.name}
              onChange={(e) => setProfileField("name", e.target.value)}
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={profile.email}
              onChange={(e) => setProfileField("email", e.target.value)}
              required
            />
          </Field>
          <Field label="Phone">
            <Input
              value={profile.phone}
              onChange={(e) => setProfileField("phone", e.target.value)}
              placeholder="+91 98765 43210"
            />
          </Field>
          <div className="md:col-span-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm shadow-black/5 md:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-black">Owner profile</h2>
          <p className="mt-1 text-sm font-semibold text-black/55">
            Add business or contact details for your rental profile.
          </p>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={submitOwnerProfile}>
          <div className="md:col-span-2">
            <Field label="Bio">
              <Textarea
                value={ownerProfileForm.bio}
                onChange={(e) => setOwnerField("bio", e.target.value)}
                placeholder="Briefly describe your products, policies, or pickup preferences"
              />
            </Field>
          </div>
          <Field label="Street">
            <Input
              value={ownerProfileForm.address.street}
              onChange={(e) => setOwnerAddressField("street", e.target.value)}
            />
          </Field>
          <Field label="City">
            <Input
              value={ownerProfileForm.address.city}
              onChange={(e) => setOwnerAddressField("city", e.target.value)}
            />
          </Field>
          <Field label="State">
            <Input
              value={ownerProfileForm.address.state}
              onChange={(e) => setOwnerAddressField("state", e.target.value)}
            />
          </Field>
          <Field label="Pincode">
            <Input
              value={ownerProfileForm.address.pincode}
              onChange={(e) => setOwnerAddressField("pincode", e.target.value)}
            />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save owner profile"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm shadow-black/5 md:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-black">Password</h2>
          <p className="mt-1 text-sm font-semibold text-black/55">
            Update the password used to sign in to your account.
          </p>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={submitPassword}>
          <Field label="Current password">
            <Input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordField("currentPassword", e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password">
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordField("newPassword", e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
