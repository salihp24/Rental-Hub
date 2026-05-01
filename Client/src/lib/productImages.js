const PLACEHOLDER_PUBLIC_ID = "demo-listing-cover";
const LOCAL_BACKEND_HOSTS = new Set(["localhost:5000", "127.0.0.1:5000"]);

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const isPlaceholderImage = (image) =>
  image?.publicId?.trim() === PLACEHOLDER_PUBLIC_ID;

const normalizeImageUrl = (value) => {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  if (!isHttpUrl(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    if (LOCAL_BACKEND_HOSTS.has(parsed.host)) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

export const getDisplayImages = (images) => {
  const validImages = (Array.isArray(images) ? images : []).filter(
    (image) => image?.publicId?.trim() && isHttpUrl(image?.url)
  );

  const realImages = validImages.filter((image) => !isPlaceholderImage(image));

  return realImages.length ? realImages : validImages;
};

export const getPrimaryImageUrl = (images) =>
  normalizeImageUrl(getDisplayImages(images)[0]?.url);

export const getImageUrl = (image) => normalizeImageUrl(image?.url);
