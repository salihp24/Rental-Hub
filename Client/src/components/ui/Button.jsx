export default function Button({
  as = "button",
  className = "",
  variant = "primary",
  ...props
}) {
  const Component = as;
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 shadow-[0_10px_24px_rgba(37,99,235,0.28)]",
    secondary:
      "bg-white text-blue-700 border border-blue-200 hover:border-blue-300 hover:bg-blue-50",
    ghost: "bg-transparent text-slate-700 hover:bg-blue-50",
  };

  return (
    <Component className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
