export default function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-black/40 focus:border-black/25 focus:ring-2 focus:ring-black/10 ${className}`}
      {...props}
    />
  );
}

