export default function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`min-h-[120px] w-full resize-y rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-black/40 focus:border-black/25 focus:ring-2 focus:ring-black/10 ${className}`}
      {...props}
    />
  );
}
