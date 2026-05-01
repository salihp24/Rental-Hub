const CLOUDINARY_HOST_PATTERN = /(^|\.)cloudinary\.com$/i;

export const isCloudinaryImageUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return CLOUDINARY_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
};

export const assertCloudinaryImages = (images = []) => {
  for (const image of images) {
    if (!isCloudinaryImageUrl(image?.url)) {
      return false;
    }
  }

  return true;
};
