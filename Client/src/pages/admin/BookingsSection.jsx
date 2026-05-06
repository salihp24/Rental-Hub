import { BOOKING_STATUSES } from "./constants";

export default function BookingsSection({ bookings, busyKey, onUpdateBookingStatus }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4">
      <h2 className="mb-3 text-lg font-extrabold">Bookings</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/60">
              <th className="py-2">Order</th>
              <th className="py-2">Product</th>
              <th className="py-2">Payment</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking._id} className="border-b border-black/5">
                <td className="py-2">{booking.orderCode}</td>
                <td className="py-2">{booking.product?.title || "-"}</td>
                <td className="py-2">{booking.paymentStatus}</td>
                <td className="py-2">
                  <select
                    className="rounded-lg border border-black/15 px-2 py-1"
                    value={booking.status}
                    onChange={(e) => onUpdateBookingStatus(booking._id, e.target.value)}
                    disabled={busyKey === `booking-status-${booking._id}`}
                  >
                    {BOOKING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
