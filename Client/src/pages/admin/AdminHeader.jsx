import Button from "../../components/ui/Button";

export default function AdminHeader({ error, onRefresh }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Admin Control Panel</h1>
          <p className="text-sm text-black/60">Manage users, products, bookings, and activity records.</p>
        </div>
        <Button onClick={onRefresh}>Refresh</Button>
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
