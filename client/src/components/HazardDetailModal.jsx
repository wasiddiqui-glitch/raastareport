import CommentsSection from "./CommentsSection";
import { API_URL } from "../config";

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

const SEV_CLASS = { Low: "badge-sev-low", Medium: "badge-sev-medium", High: "badge-sev-high", Critical: "badge-sev-critical" };

function HazardDetailModal({ hazard, onClose, upvotedIds, onUpvote, onStatusChange, onToggleRecurring }) {
  const age = daysSince(hazard.createdAt);
  const isAging = hazard.status !== "Fixed" && age >= 30;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="hdm" onClick={(e) => e.stopPropagation()}>

        {/* Sticky header */}
        <div className="hdm-header">
          <h2 className="hdm-title">{hazard.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Photo */}
        {hazard.imageUrl && (
          <img
            src={`${API_URL}${hazard.imageUrl}`}
            alt={hazard.title}
            className="hdm-photo"
          />
        )}

        <div className="hdm-body">

          {/* Badges */}
          <div className="hdm-badges">
            <span className="badge badge-type">{hazard.type}</span>
            <span className={`badge ${
              hazard.status === "Reported" ? "badge-status-reported"
              : hazard.status === "In Progress" ? "badge-status-progress"
              : "badge-status-fixed"
            }`}>{hazard.status}</span>
            {hazard.severity && hazard.severity !== "Unknown" && (
              <span className={`badge badge-severity ${SEV_CLASS[hazard.severity] || ""}`}>{hazard.severity}</span>
            )}
            {hazard.isRecurring && <span className="badge badge-recurring">↩ Recurring</span>}
            {isAging && <span className="badge badge-aging">⏱ {age}d unresolved</span>}
          </div>

          {/* Meta row */}
          <div className="hdm-meta">
            {[hazard.area, hazard.city].filter(Boolean).length > 0 && (
              <span>📍 {[hazard.area, hazard.city].filter(Boolean).join(", ")}</span>
            )}
            <span>🕐 {timeAgo(hazard.createdAt)}</span>
            {hazard.reporterName && <span>👤 {hazard.reporterName}</span>}
          </div>

          {/* Description */}
          <p className="hdm-description">{hazard.description}</p>

          {/* Coordinates */}
          {hazard.latitude && hazard.longitude && (
            <p className="hdm-coords">
              {hazard.latitude.toFixed(5)}, {hazard.longitude.toFixed(5)}
            </p>
          )}

          {/* Actions */}
          <div className="hdm-actions">
            <button
              className={`upvote-btn${upvotedIds.has(hazard.id) ? " upvote-btn--voted" : ""}`}
              onClick={() => onUpvote(hazard.id)}
              title={upvotedIds.has(hazard.id) ? "Click to undo upvote" : "I've seen this too"}
            >
              ▲ <span>{hazard.upvotes}</span>
            </button>

            <button
              className={`recurring-btn ${hazard.isRecurring ? "recurring-btn--active" : ""}`}
              onClick={() => onToggleRecurring(hazard.id)}
              title={hazard.isRecurring ? "Unmark as recurring" : "Mark as recurring issue"}
            >
              ↩ {hazard.isRecurring ? "Recurring" : "Mark Recurring"}
            </button>

            <select
              className="status-select"
              value={hazard.status}
              onChange={(e) => onStatusChange(hazard.id, e.target.value)}
            >
              <option value="Reported">Reported</option>
              <option value="In Progress">In Progress</option>
              <option value="Fixed">Fixed</option>
            </select>
          </div>

          {/* Comments */}
          <div className="hdm-comments">
            <p className="hdm-comments-label">Updates & Comments</p>
            <CommentsSection hazardId={hazard.id} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default HazardDetailModal;
