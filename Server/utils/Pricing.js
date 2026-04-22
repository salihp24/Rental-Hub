export const computePricing = (pricing, totalDays) => {
  const baseRate = pricing.daily.rate;
  const subtotal = baseRate * totalDays;

  //  Ensures slabs are checked in correct order
  const slabs = [...(pricing.slabs || [])].sort((a, b) => a.minDays - b.minDays);

  // Find Matching Slab
  const appliedSlab =
    slabs.find(
      (s) => totalDays >= s.minDays && totalDays <= s.maxDays
    ) || null;

// Get Discount %
  const discountPercent = appliedSlab ? appliedSlab.discountPercent : 0;

// Calculate Discount
  const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(2);

  const rentalAmount = +(subtotal - discountAmount).toFixed(2);
  const deposit = pricing.deposit || 0;

  //revenue
  const platformFee = +(rentalAmount * 0.05).toFixed(2);
  const totalAmount = +(rentalAmount + deposit + platformFee).toFixed(2);

  return {
    baseRate,
    appliedSlab,
    subtotal: +subtotal.toFixed(2),
    discountAmount,
    rentalAmount,
    deposit,
    platformFee,
    totalAmount,
    currency: pricing.currency || "INR",
  };
};