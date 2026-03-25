import { useRef, useState } from "react";
import { API_URL } from "../config";
import LocationPickerMap from "./LocationPickerMap";

function HazardForm({ onHazardAdded }) {
  const [formData, setFormData] = useState({
    title: "",
    type: "",
    description: "",
    city: "",
    area: "",
    latitude: "",
    longitude: "",
    reporterName: "",
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState(null); // { similar: hazard } or null
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const fileInputRef = useRef(null);

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (aiSuggested && (e.target.name === "type" || e.target.name === "description")) {
      setAiSuggested(false);
    }
    // Clear duplicate warning when key fields change
    if (["type", "city", "area"].includes(e.target.name)) {
      setDuplicate(null);
      setShowDuplicateWarning(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAiAnalyzing(true);
    setAiSuggested(false);

    try {
      const body = new FormData();
      body.append("photo", file);

      const res = await fetch(`${API_URL}/api/ai/analyze-image`, {
        method: "POST",
        body,
      });

      if (res.ok) {
        const { type, description } = await res.json();
        setFormData((prev) => ({
          ...prev,
          type: type || prev.type,
          description: description || prev.description,
        }));
        setAiSuggested(true);
      }
    } catch {
      // Silently fail — user can fill fields manually
    } finally {
      setAiAnalyzing(false);
    }
  }

  function handleLocationSelect(lat, lng) {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  }

  function handleLocationResolve({ city, area }) {
    setFormData((prev) => ({
      ...prev,
      city: prev.city || city,
      area: prev.area || area,
    }));
  }

  async function checkForDuplicate() {
    const { type, city, area, latitude, longitude } = formData;
    if (!type || !city) return false;

    const params = new URLSearchParams({ type, city });
    if (area) params.append("area", area);
    if (latitude) params.append("lat", latitude);
    if (longitude) params.append("lng", longitude);

    try {
      const res = await fetch(`${API_URL}/api/hazards/check-duplicate?${params}`);
      const data = await res.json();
      if (data.isDuplicate) {
        setDuplicate(data.similar);
        setShowDuplicateWarning(true);
        return true;
      }
    } catch {
      // ignore — let submit proceed
    }
    return false;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // If duplicate warning is already shown and user is re-submitting, proceed
    if (!showDuplicateWarning) {
      const isDuplicate = await checkForDuplicate();
      if (isDuplicate) return; // stop and show warning
    }

    setSubmitting(true);
    setMessage("");
    setShowDuplicateWarning(false);

    try {
      const body = new FormData();
      body.append("title", formData.title);
      body.append("type", formData.type);
      body.append("description", formData.description);
      body.append("city", formData.city);
      body.append("area", formData.area);
      if (formData.latitude) body.append("latitude", Number(formData.latitude));
      if (formData.longitude) body.append("longitude", Number(formData.longitude));
      if (formData.reporterName) body.append("reporterName", formData.reporterName);
      if (photoFile) body.append("photo", photoFile);

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/hazards`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit hazard");

      onHazardAdded(data);

      setFormData({ title: "", type: "", description: "", city: "", area: "", latitude: "", longitude: "", reporterName: "" });
      setPhotoFile(null);
      setPhotoPreview(null);
      setAiSuggested(false);
      setDuplicate(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Hazard submitted successfully.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPosition =
    formData.latitude && formData.longitude
      ? [Number(formData.latitude), Number(formData.longitude)]
      : null;

  return (
    <form className="hazard-form" onSubmit={handleSubmit}>
      <h2>Report a Hazard</h2>

      <input
        type="text"
        name="title"
        placeholder="Hazard title"
        value={formData.title}
        onChange={handleChange}
      />

      <div className="field-with-ai">
        <select name="type" value={formData.type} onChange={handleChange}>
          <option value="" disabled>Select hazard type</option>
          <option>Pothole</option>
          <option>Open Manhole</option>
          <option>Broken Traffic Light</option>
          <option>Flooded Road</option>
          <option>Construction Debris</option>
          <option>Missing Road Sign</option>
          <option>Damaged Divider</option>
          <option>Street Light Out</option>
          <option>Other</option>
        </select>
        {aiAnalyzing && <span className="ai-badge ai-badge--loading">⟳ Analyzing photo...</span>}
        {aiSuggested && !aiAnalyzing && <span className="ai-badge ai-badge--done">✦ AI suggested</span>}
      </div>

      <div className="field-with-ai">
        <textarea
          name="description"
          placeholder="Describe the hazard"
          value={formData.description}
          onChange={handleChange}
        />
        {aiSuggested && !aiAnalyzing && <span className="ai-badge ai-badge--done">✦ AI suggested</span>}
      </div>

      <input type="text" name="city" placeholder="City" value={formData.city} onChange={handleChange} />
      <input type="text" name="area" placeholder="Area / neighborhood" value={formData.area} onChange={handleChange} />
      <input type="text" name="reporterName" placeholder="Your name (optional)" value={formData.reporterName} onChange={handleChange} />

      {/* DUPLICATE WARNING */}
      {showDuplicateWarning && duplicate && (
        <div className="duplicate-warning">
          <span className="duplicate-icon">⚠</span>
          <div className="duplicate-body">
            <strong>Possible duplicate found:</strong> "{duplicate.title}" was already reported
            {duplicate.area ? ` in ${duplicate.area}` : ""}.
            <div className="duplicate-actions">
              <button type="submit" className="duplicate-submit-anyway">
                Submit Anyway
              </button>
              <button
                type="button"
                className="duplicate-cancel"
                onClick={() => setShowDuplicateWarning(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO UPLOAD */}
      <div className="photo-upload-area">
        <p className="map-label">
          Photo (optional)
          {!photoPreview && <span className="ai-hint"> — AI will auto-fill type & description from your photo</span>}
        </p>
        <label className="photo-upload-label">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          {photoPreview ? (
            <div className="photo-preview-wrap">
              <img src={photoPreview} alt="Preview" className="photo-preview" />
              {aiAnalyzing && (
                <div className="photo-analyzing-overlay">
                  <span>✦ Analyzing with AI...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="photo-upload-placeholder">
              <span className="photo-upload-icon">⊕</span>
              <span>Click to attach a photo</span>
            </div>
          )}
        </label>
        {photoPreview && !aiAnalyzing && (
          <button
            type="button"
            className="photo-remove-btn"
            onClick={() => {
              setPhotoFile(null);
              setPhotoPreview(null);
              setAiSuggested(false);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            Remove photo
          </button>
        )}
      </div>

      {/* MAP */}
      <div>
        <p className="map-label">Click on the map to select hazard location</p>
        <LocationPickerMap selectedPosition={selectedPosition} onLocationSelect={handleLocationSelect} onLocationResolve={handleLocationResolve} />
        <p className="coords-text">
          <strong>Latitude:</strong> {formData.latitude || "Not selected"}
          &nbsp; <strong>Longitude:</strong> {formData.longitude || "Not selected"}
        </p>
      </div>

      <button type="submit" disabled={submitting || aiAnalyzing || showDuplicateWarning}>
        {submitting ? "Submitting..." : "Submit Hazard"}
      </button>

      {message && <p className="form-message">{message}</p>}
    </form>
  );
}

export default HazardForm;
