export default function Button({
  as = "button",
  className = "",
  variant = "primary",
  ...props
}) {
  const Component = as;
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-black text-white hover:bg-black/90 shadow-sm shadow-black/10",
    secondary:
      "bg-white text-black border border-black/10 hover:border-black/20 hover:bg-black/[0.02]",
    ghost: "bg-transparent text-black hover:bg-black/[0.04]",
  };

  return (
    <Component className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}

