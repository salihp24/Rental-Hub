import { useEffect, useState } from "react";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import BookingsSection from "./BookingsSection";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/bookings?limit=20&sort=-createdAt");
      setBookings(res?.data?.data?.bookings || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBookings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateBookingStatus = async (bookingId, status) => {
    setBusyKey(`booking-status-${bookingId}`);
    try {
      const payload = { status };
      if (status === "cancelled" || status === "rejected") {
        payload.reason = "Updated by admin";
      }
      const res = await api.patch(`/admin/bookings/${bookingId}/status`, payload);
      const updatedBooking = res?.data?.data?.booking;
      if (updatedBooking?._id) {
        setBookings((prev) =>
          prev.map((booking) => (booking._id === updatedBooking._id ? updatedBooking : booking))
        );
      }
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Booking Management</h1>
          <Button onClick={loadBookings}>Refresh</Button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      {loading ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm">Loading bookings...</div>
      ) : (
        <BookingsSection
          bookings={bookings}
          busyKey={busyKey}
          onUpdateBookingStatus={updateBookingStatus}
        />
      )}
    </div>
  );
}
