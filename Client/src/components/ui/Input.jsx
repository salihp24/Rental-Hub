export default function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 ${className}`}
      {...props}
    />
  );
}
