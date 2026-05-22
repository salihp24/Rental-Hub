import Button from "../../components/ui/Button";
import { badgeClassByStatus, cardClass } from "./ui.jsx";

export default function UsersSection({
  users,
  busyKey,
  onUpdateUserStatus,
  onToggleOwnerActivity,
}) {
  const getCurrentRole = (roles = []) => {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("owner")) return "owner";
    return "renter";
  };

  return (
    <section className={`p-4 ${cardClass}`}>
      <h2 className="mb-3 text-lg font-extrabold">Users</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
              <tr className="border-b border-black/10 text-black/60">
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Status</th>
              <th className="py-2">Role</th>
              <th className="py-2">Owner Activity</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-b border-black/5 transition hover:bg-black/[0.02]">
                <td className="py-2">{user.name}</td>
                <td className="py-2">{user.email}</td>
                <td className="py-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassByStatus(user.isActive ? "active" : "inactive")}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {getCurrentRole(user.role || [])}
                  </span>
                </td>
                <td className="py-2">
                  {user.role?.includes("owner") ? (
                    <Button
                      variant="secondary"
                      onClick={() => onToggleOwnerActivity(user)}
                      disabled={busyKey === `owner-suspend-${user._id}`}
                      className="shadow-sm hover:shadow"
                    >
                      {user.ownerProfile?.activitySuspended ? "Enable Owner" : "Disable Owner"}
                    </Button>
                  ) : (
                    <span className="text-xs text-black/50">User is not an owner</span>
                  )}
                </td>
                <td className="py-2">
                  <Button
                    variant="secondary"
                    onClick={() => onUpdateUserStatus(user._id, !user.isActive)}
                    disabled={busyKey === `user-status-${user._id}`}
                    className="shadow-sm hover:shadow"
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
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
