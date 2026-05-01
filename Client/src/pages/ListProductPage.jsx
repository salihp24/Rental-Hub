import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import Button from "../components/ui/Button";
import CategoryTreeSelect from "../components/Categories/CategoryTreeSelect";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

const CANCELLATION = [
  { value: "flexible", label: "Flexible" },
  { value: "moderate", label: "Moderate" },
  { value: "strict", label: "Strict" },
];

const emptyImageRow = () => ({
  url: "",
  publicId: "",
});

const emptySlabRow = () => ({
  minDays: "7",
  maxDays: "30",
  discountPercent: "10",
});

function normaliseCategoryId(id) {
  if (id == null) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object" && id.$oid) return String(id.$oid);
  return String(id);
}

function validateSlabsForSubmit(slabs) {
  if (!slabs.length) return { error: null, slabs: [] };

  const clean = [];
  for (let i = 0; i < slabs.length; i++) {
    const slab = slabs[i];
    const minDays = Number(slab.minDays);
    const maxDays = Number(slab.maxDays);
    const discountPercent = Number(slab.discountPercent);

    if (!Number.isInteger(minDays) || minDays < 1) {
      return { error: `Slab ${i + 1}: min days must be an integer >= 1.`, slabs: null };
    }
    if (!Number.isInteger(maxDays) || maxDays < minDays) {
      return { error: `Slab ${i + 1}: max days must be an integer >= min days.`, slabs: null };
    }
    if (maxDays > 9999) {
      return { error: `Slab ${i + 1}: max days must be <= 9999.`, slabs: null };
    }
    if (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return { error: `Slab ${i + 1}: discount must be between 0 and 100.`, slabs: null };
    }

    clean.push({ minDays, maxDays, discountPercent });
  }

  const sorted = [...clean].sort((a, b) => a.minDays - b.minDays);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minDays <= sorted[i - 1].maxDays) {
      return {
        error:
          "Pricing slabs must not overlap: each slab minimum day must be greater than the previous slab maximum day.",
        slabs: null,
      };
    }
  }

  return { error: null, slabs: clean };
}

function buildAttributesState(node) {
  if (!node?.attributes?.length) return {};

  const next = {};
  for (const attr of node.attributes) {
    if (attr.type === "boolean") {
      next[attr.key] = false;
    } else if (attr.type === "select") {
      next[attr.key] = attr.isRequired ? (attr.options?.[0] ?? "") : "";
    } else {
      next[attr.key] = "";
    }
  }

  return next;
}

export default function ListProductPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const isEditing = Boolean(productId);

  const [categoryId, setCategoryId] = useState("");
  const [selectedCategoryNode, setSelectedCategoryNode] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("good");

  const [images, setImages] = useState([emptyImageRow()]);

  const [dailyRate, setDailyRate] = useState("");
  const [deposit, setDeposit] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [hourlyEnabled, setHourlyEnabled] = useState(false);
  const [hourlyRate, setHourlyRate] = useState("0");
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyRate, setWeeklyRate] = useState("0");
  const [slabs, setSlabs] = useState([]);

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [minRentalDays, setMinRentalDays] = useState("1");
  const [maxRentalDays, setMaxRentalDays] = useState("30");
  const [advanceBookingDays, setAdvanceBookingDays] = useState("30");
  const [cancellationPolicy, setCancellationPolicy] = useState("moderate");

  const [attributes, setAttributes] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const mergeAttributeState = useCallback((node, existing = {}) => {
    if (!node?.attributes?.length) return {};

    const defaults = buildAttributesState(node);
    const merged = { ...defaults };

    for (const attr of node.attributes) {
      if (Object.prototype.hasOwnProperty.call(existing, attr.key)) {
        merged[attr.key] = existing[attr.key];
      }
    }

    return merged;
  }, []);

  const handleCategoryChange = useCallback(
    (id, node) => {
      setCategoryId(normaliseCategoryId(id));
      setSelectedCategoryNode(node || null);
      setAttributes((prev) => mergeAttributeState(node, prev));
    },
    [mergeAttributeState]
  );

  useEffect(() => {
    if (!isEditing) return;

    let alive = true;

    (async () => {
      setLoadingProduct(true);
      setError(null);

      try {
        const res = await api.get(`/products/${productId}`);
        const product = res.data?.data?.product;

        if (!alive || !product) return;

        setCategoryId(normaliseCategoryId(product.category?._id || product.category));
        setSelectedCategoryNode(product.category || null);
        setTitle(product.title || "");
        setDescription(product.description || "");
        setCondition(product.condition || "good");
        setImages(
          product.images?.length
            ? product.images.map((image) => ({
                url: image.url || "",
                publicId: image.publicId || "",
              }))
            : [emptyImageRow()]
        );
        setDailyRate(String(product.pricing?.daily?.rate ?? ""));
        setDeposit(String(product.pricing?.deposit ?? 0));
        setCurrency(product.pricing?.currency || "INR");
        setHourlyEnabled(Boolean(product.pricing?.hourly?.enabled));
        setHourlyRate(String(product.pricing?.hourly?.rate ?? 0));
        setWeeklyEnabled(Boolean(product.pricing?.weekly?.enabled));
        setWeeklyRate(String(product.pricing?.weekly?.rate ?? 0));
        setSlabs(
          (product.pricing?.slabs || []).map((slab) => ({
            minDays: String(slab.minDays ?? ""),
            maxDays: String(slab.maxDays ?? ""),
            discountPercent: String(slab.discountPercent ?? ""),
          }))
        );
        setAddress(product.location?.address || "");
        setCity(product.location?.city || "");
        setState(product.location?.state || "");
        setPincode(product.location?.pincode || "");
        setLatitude(
          product.location?.coordinates?.coordinates?.[1] != null &&
          product.location?.coordinates?.coordinates?.[1] !== 0
            ? String(product.location.coordinates.coordinates[1])
            : ""
        );
        setLongitude(
          product.location?.coordinates?.coordinates?.[0] != null &&
          product.location?.coordinates?.coordinates?.[0] !== 0
            ? String(product.location.coordinates.coordinates[0])
            : ""
        );
        setMinRentalDays(String(product.rentalRules?.minRentalDays ?? 1));
        setMaxRentalDays(String(product.rentalRules?.maxRentalDays ?? 30));
        setAdvanceBookingDays(String(product.rentalRules?.advanceBookingDays ?? 30));
        setCancellationPolicy(product.rentalRules?.cancellationPolicy || "moderate");
        setAttributes(product.attributes || {});
      } catch (err) {
        if (alive) {
          setError(err?.response?.data?.message || err.message || "Could not load listing.");
        }
      } finally {
        if (alive) setLoadingProduct(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isEditing, productId]);

  const pageTitle = useMemo(
    () => (isEditing ? "Edit your listing" : "List a product"),
    [isEditing]
  );
  const submitLabel = useMemo(() => {
    if (submitting) return isEditing ? "Saving..." : "Publishing...";
    return isEditing ? "Save changes" : "Publish listing";
  }, [isEditing, submitting]);

  const updateImage = (index, field, value) => {
    setImages((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const uploadProductImages = async (files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;

    setError(null);
    setSuccess(null);
    setUploadingImages(true);

    const formData = new FormData();
    selected.forEach((file) => formData.append("images", file));

    try {
      const res = await api.post("/uploads/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploaded = res.data?.data?.images || [];

      if (!uploaded.length) {
        setError("No images were uploaded.");
        return;
      }

      setImages((prev) => {
        const existing = prev.filter((img) => img.url.trim() || img.publicId.trim());
        return [...existing, ...uploaded];
      });
      setSuccess(`${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not upload images.");
    } finally {
      setUploadingImages(false);
    }
  };

  const addImageRow = () => setImages((prev) => [...prev, emptyImageRow()]);
  const removeImageRow = (index) =>
    setImages((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const updateSlab = (index, field, value) => {
    setSlabs((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addSlabRow = () => setSlabs((prev) => [...prev, emptySlabRow()]);
  const removeSlabRow = (index) => setSlabs((prev) => prev.filter((_, i) => i !== index));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!categoryId) {
      setError("Please choose a category.");
      return;
    }

    const rate = Number(dailyRate);
    if (Number.isNaN(rate) || rate < 0) {
      setError("Daily rate must be a valid number >= 0.");
      return;
    }

    const dep = Number(deposit);
    if (Number.isNaN(dep) || dep < 0) {
      setError("Deposit must be a valid number >= 0.");
      return;
    }

    const { error: slabError, slabs: slabPayload } = validateSlabsForSubmit(slabs);
    if (slabError) {
      setError(slabError);
      return;
    }

    const imagePayload = images
      .map((img) => ({
        url: img.url.trim(),
        publicId: img.publicId.trim(),
      }))
      .filter((img) => img.url && img.publicId);

    if (!imagePayload.length) {
      setError("Add at least one image with URL and public ID.");
      return;
    }

    for (const img of imagePayload) {
      if (!/^https?:\/\//i.test(img.url)) {
        setError("Each image URL must use HTTP or HTTPS.");
        return;
      }
    }

    const minD = Number(minRentalDays);
    const maxD = Number(maxRentalDays);
    const adv = Number(advanceBookingDays);
    const hasLatitude = latitude.trim() !== "";
    const hasLongitude = longitude.trim() !== "";

    if (hasLatitude !== hasLongitude) {
      setError("Enter both latitude and longitude, or leave both empty.");
      return;
    }

    if (hasLatitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);

      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        setError("Latitude must be between -90 and 90.");
        return;
      }

      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        setError("Longitude must be between -180 and 180.");
        return;
      }
    }

    if (!Number.isInteger(minD) || minD < 1) {
      setError("Minimum rental days must be an integer >= 1.");
      return;
    }
    if (!Number.isInteger(maxD) || maxD < minD) {
      setError("Maximum rental days must be an integer >= minimum rental days.");
      return;
    }
    if (!Number.isInteger(adv) || adv < 0) {
      setError("Advance booking days must be an integer >= 0.");
      return;
    }

    const attrPayload = { ...attributes };
    if (selectedCategoryNode?.attributes?.length) {
      for (const attr of selectedCategoryNode.attributes) {
        const raw = attrPayload[attr.key];
        if (attr.isRequired && (raw === "" || raw === null || raw === undefined)) {
          setError(`Please fill in "${attr.name}".`);
          return;
        }
        if (attr.type === "number" && raw !== "" && raw !== undefined) {
          attrPayload[attr.key] = Number(raw);
          if (Number.isNaN(attrPayload[attr.key])) {
            setError(`"${attr.name}" must be a number.`);
            return;
          }
        }
        if (attr.type === "boolean") {
          attrPayload[attr.key] = Boolean(raw);
        }
      }
    }

    const body = {
      category: categoryId,
      title: title.trim(),
      description: description.trim(),
      images: imagePayload,
      attributes: attrPayload,
      pricing: {
        hourly: {
          enabled: hourlyEnabled,
          rate: Number(hourlyRate) || 0,
        },
        daily: {
          enabled: true,
          rate,
        },
        weekly: {
          enabled: weeklyEnabled,
          rate: Number(weeklyRate) || 0,
        },
        slabs: slabPayload,
        deposit: dep,
        currency: currency.trim().toUpperCase() || "INR",
      },
      location: {
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        coordinates: {
          type: "Point",
          coordinates: hasLatitude ? [Number(longitude), Number(latitude)] : [0, 0],
        },
      },
      rentalRules: {
        minRentalDays: minD,
        maxRentalDays: maxD,
        advanceBookingDays: adv,
        cancellationPolicy,
      },
      condition,
      status: "active",
    };

    if (!body.location.city || !body.location.state) {
      setError("City and state are required.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        await api.patch(`/products/${productId}`, body);
        setSuccess("Listing updated successfully.");
        setTimeout(() => navigate("/account"), 900);
      } else {
        await api.post("/products", body);
        setSuccess("Listing created successfully.");
        setTimeout(() => navigate("/"), 900);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          (isEditing ? "Could not update listing." : "Could not create listing.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-black/50">
            Owner
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-black md:text-3xl">
            {pageTitle}
          </h1>
        </div>
        <Button variant="secondary" as={Link} to={isEditing ? "/account" : "/"}>
          Cancel
        </Button>
      </div>

      {loadingProduct ? (
        <div className="h-96 animate-pulse rounded-3xl border border-black/10 bg-white" />
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-8 rounded-3xl border border-black/10 bg-white p-6 shadow-sm shadow-black/5 md:p-8"
        >
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              {success}
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="text-sm font-extrabold text-black">Basics</div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-black/70">Category</div>
              <p className="text-[11px] font-semibold text-black/45">
                Pick the most specific node, such as Samsung under Android. Product browse filters
                include everything under a parent category.
              </p>
              <CategoryTreeSelect
                value={categoryId}
                onChange={handleCategoryChange}
                onMetaChange={(node) => {
                  setSelectedCategoryNode(node || null);
                  setAttributes((prev) => mergeAttributeState(node, prev));
                }}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-black/70">Title</div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                minLength={3}
                maxLength={100}
                required
                placeholder="e.g. Sony A7 III with 28-70mm kit"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-black/70">Description</div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minLength={10}
                maxLength={2000}
                required
                placeholder="What's included, condition notes, pickup expectations..."
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-black/70">Condition</div>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-black outline-none focus:border-black/25 focus:ring-2 focus:ring-black/10"
              >
                {CONDITIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {selectedCategoryNode?.attributes?.length ? (
            <section className="space-y-4">
              <div className="text-sm font-extrabold text-black">Category details</div>
              <div className="grid gap-4 sm:grid-cols-2">
                {selectedCategoryNode.attributes.map((attr) => (
                  <div key={attr.key} className="space-y-2 sm:col-span-2">
                    <div className="text-xs font-extrabold text-black/70">
                      {attr.name}
                      {attr.isRequired ? <span className="text-red-600"> *</span> : null}
                    </div>
                    {attr.type === "select" ? (
                      <select
                        value={attributes[attr.key] ?? ""}
                        onChange={(e) =>
                          setAttributes((prev) => ({ ...prev, [attr.key]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-black/25 focus:ring-2 focus:ring-black/10"
                        required={attr.isRequired}
                      >
                        {!attr.isRequired ? <option value="">-</option> : null}
                        {(attr.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : attr.type === "boolean" ? (
                      <label className="flex items-center gap-2 text-sm font-semibold text-black">
                        <input
                          type="checkbox"
                          checked={Boolean(attributes[attr.key])}
                          onChange={(e) =>
                            setAttributes((prev) => ({ ...prev, [attr.key]: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-black/20"
                        />
                        Yes
                      </label>
                    ) : (
                      <Input
                        type={attr.type === "number" ? "number" : "text"}
                        value={attributes[attr.key] ?? ""}
                        onChange={(e) =>
                          setAttributes((prev) => ({ ...prev, [attr.key]: e.target.value }))
                        }
                        required={attr.isRequired}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4">
            <div className="text-sm font-extrabold text-black">Images</div>
            <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold text-black/70">Upload product photos</div>
                  <div className="mt-1 text-[11px] font-semibold text-black/45">
                    JPG, PNG, WEBP, or GIF. Up to 5 files per upload.
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:border-black/20 hover:bg-black/[0.02]">
                  {uploadingImages ? "Uploading..." : "Choose files"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    disabled={uploadingImages || submitting}
                    onChange={(e) => {
                      uploadProductImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-3">
              {images.map((row, i) => (
                <div
                  key={i}
                  className="grid gap-3 rounded-2xl border border-black/10 bg-[#FFF7D1]/40 p-4 md:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-2">
                    <div className="text-[11px] font-extrabold text-black/60">Image URL</div>
                    <Input
                      value={row.url}
                      onChange={(e) => updateImage(i, "url", e.target.value)}
                      placeholder="https://..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] font-extrabold text-black/60">Public ID</div>
                    <Input
                      value={row.publicId}
                      onChange={(e) => updateImage(i, "publicId", e.target.value)}
                      placeholder="folder/my-photo"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full md:w-auto"
                      onClick={() => removeImageRow(i)}
                      disabled={images.length <= 1}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" onClick={addImageRow}>
              Add another image
            </Button>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-extrabold text-black">Pricing</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">Daily rate</div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(e.target.value)}
                  required
                  placeholder="499"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">Security deposit</div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">Currency (ISO)</div>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.slice(0, 3))}
                  maxLength={3}
                  placeholder="INR"
                />
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-black">
                <input
                  type="checkbox"
                  checked={hourlyEnabled}
                  onChange={(e) => setHourlyEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-black/20"
                />
                Hourly pricing
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                disabled={!hourlyEnabled}
                placeholder="Hourly rate"
              />
              <label className="flex items-center gap-2 text-sm font-semibold text-black">
                <input
                  type="checkbox"
                  checked={weeklyEnabled}
                  onChange={(e) => setWeeklyEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-black/20"
                />
                Weekly flat rate
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={weeklyRate}
                onChange={(e) => setWeeklyRate(e.target.value)}
                disabled={!weeklyEnabled}
                placeholder="Weekly rate"
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold text-black/70">Discount slabs (optional)</div>
                  <div className="text-[11px] font-semibold text-black/45">
                    If rent length falls in a range, that discount percent applies to daily rate x
                    days. Ranges must not overlap; use 9999 as max for "and above".
                  </div>
                </div>
                <Button type="button" variant="secondary" onClick={addSlabRow}>
                  Add slab
                </Button>
              </div>
              {!slabs.length ? (
                <div className="text-xs font-semibold text-black/45">No slabs - full daily rate applies.</div>
              ) : null}
              {slabs.map((row, i) => (
                <div
                  key={i}
                  className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4 md:grid-cols-4"
                >
                  <div className="space-y-2">
                    <div className="text-[11px] font-extrabold text-black/60">Min days</div>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={row.minDays}
                      onChange={(e) => updateSlab(i, "minDays", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] font-extrabold text-black/60">Max days</div>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={row.maxDays}
                      onChange={(e) => updateSlab(i, "maxDays", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] font-extrabold text-black/60">Discount %</div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={row.discountPercent}
                      onChange={(e) => updateSlab(i, "discountPercent", e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="ghost" onClick={() => removeSlabRow(i)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-extrabold text-black">Location</div>
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-black/70">Address (optional)</div>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">City</div>
                <Input value={city} onChange={(e) => setCity(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">State</div>
                <Input value={state} onChange={(e) => setState(e.target.value)} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="text-xs font-extrabold text-black/70">Pincode (optional)</div>
                <Input value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">Latitude (optional)</div>
                <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="9.931233" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">Longitude (optional)</div>
                <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="76.267303" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-sm font-extrabold text-black">Rental rules</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">Min days</div>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={minRentalDays}
                  onChange={(e) => setMinRentalDays(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">Max days</div>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={maxRentalDays}
                  onChange={(e) => setMaxRentalDays(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-black/70">Advance booking (days)</div>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={advanceBookingDays}
                  onChange={(e) => setAdvanceBookingDays(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-black/70">Cancellation policy</div>
              <select
                value={cancellationPolicy}
                onChange={(e) => setCancellationPolicy(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-black/25 focus:ring-2 focus:ring-black/10"
              >
                {CANCELLATION.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <Button className="w-full" type="submit" disabled={submitting || !categoryId}>
            {submitLabel}
          </Button>
        </form>
      )}
    </div>
  );
}
