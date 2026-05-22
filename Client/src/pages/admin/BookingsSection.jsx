import { badgeClassByStatus, cardClass } from "./ui.jsx";

export default function BookingsSection({ bookings, busyKey, onUpdateBookingStatus }) {
  const getAdminActions = (booking) => {
    if (["completed", "cancelled", "rejected"].includes(booking.status)) {
      return [];
    }
    return ["cancelled", "rejected"];
  };

  return (
    <section className={`p-4 ${cardClass}`}>
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
              <tr key={booking._id} className="border-b border-black/5 transition hover:bg-black/[0.02]">
                <td className="py-2">{booking.orderCode}</td>
                <td className="py-2">{booking.product?.title || "-"}</td>
                <td className="py-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassByStatus(booking.paymentStatus)}`}>
                    {booking.paymentStatus}
                  </span>
                </td>
                <td className="py-2">
                  <span className={`mr-2 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassByStatus(booking.status)}`}>
                    {booking.status}
                  </span>
                  {getAdminActions(booking).length ? (
                    <select
                      className="rounded-lg border border-black/15 px-2 py-1 transition hover:border-black/30"
                      value=""
                      onChange={(e) => onUpdateBookingStatus(booking._id, e.target.value)}
                      disabled={busyKey === `booking-status-${booking._id}`}
                    >
                      <option value="" disabled>
                        Admin action
                      </option>
                      {getAdminActions(booking).map((action) => (
                        <option key={action} value={action}>
                          Set as {action}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-black/50">No available action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
