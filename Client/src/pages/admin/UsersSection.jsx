import Button from "../../components/ui/Button";
import { USER_ROLES } from "./constants";

export default function UsersSection({
  users,
  busyKey,
  onUpdateUserRole,
  onUpdateUserStatus,
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4">
      <h2 className="mb-3 text-lg font-extrabold">Users</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/60">
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Status</th>
              <th className="py-2">Role</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-b border-black/5">
                <td className="py-2">{user.name}</td>
                <td className="py-2">{user.email}</td>
                <td className="py-2">{user.isActive ? "Active" : "Inactive"}</td>
                <td className="py-2">
                  <select
                    className="rounded-lg border border-black/15 px-2 py-1"
                    value={user.role?.[0] || "renter"}
                    onChange={(e) => onUpdateUserRole(user._id, e.target.value)}
                    disabled={busyKey === `user-role-${user._id}`}
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <Button
                    variant="secondary"
                    onClick={() => onUpdateUserStatus(user._id, !user.isActive)}
                    disabled={busyKey === `user-status-${user._id}`}
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
