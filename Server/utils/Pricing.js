const UNIT_LABELS = {
  hourly: "hour",
  daily: "day",
  weekly: "week",
};

export const computePricing = (pricing, totalUnits, options = {}) => {
  const pricingUnit = options.pricingUnit || "daily";
  const quantity = Number(totalUnits || 0);

  let baseRate = 0;
  if (options.baseRateOverride != null) {
    baseRate = Number(options.baseRateOverride);
  } else if (pricingUnit === "hourly") {
    baseRate = Number(pricing?.hourly?.rate || 0);
  } else if (pricingUnit === "weekly") {
    baseRate = Number(pricing?.weekly?.rate || 0);
  } else {
    baseRate = Number(pricing?.daily?.rate || 0);
  }

  const subtotal = baseRate * quantity;

  const slabs =
    pricingUnit === "daily"
      ? [...(pricing.slabs || [])].sort((a, b) => a.minDays - b.minDays)
      : [];

  const appliedSlab =
    pricingUnit === "daily"
      ? slabs.find((s) => quantity >= s.minDays && quantity <= s.maxDays) || null
      : null;

  const discountPercent = appliedSlab ? appliedSlab.discountPercent : 0;
  const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(2);
  const rentalAmount = +(subtotal - discountAmount).toFixed(2);
  const deposit = Number(pricing?.deposit || 0);
  const platformFee = +(rentalAmount * 0.05).toFixed(2);
  const totalAmount = +(rentalAmount + deposit + platformFee).toFixed(2);

  return {
    pricingUnit,
    unitLabel: UNIT_LABELS[pricingUnit] || "unit",
    totalUnits: quantity,
    baseRate,
    appliedSlab,
    subtotal: +subtotal.toFixed(2),
    discountAmount,
    rentalAmount,
    deposit,
    platformFee,
    totalAmount,
    currency: options.currencyOverride || pricing.currency || "INR",
  };
};
