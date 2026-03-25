import { useEffect, useMemo, useState } from "react";
import { API_URL } from "./config";
import Navbar from "./components/Navbar";
import HazardForm from "./components/HazardForm";
import HazardMap from "./components/HazardMap";
import CommentsSection from "./components/CommentsSection";
import HazardDetailModal from "./components/HazardDetailModal";
import AuthModal from "./components/AuthModal";
import "./App.css";

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

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function SeverityBadge({ severity }) {
  if (!severity || severity === "Unknown") return null;
  const cls = {
    Low: "badge-sev-low",
    Medium: "badge-sev-medium",
    High: "badge-sev-high",
    Critical: "badge-sev-critical",
  }[severity] || "";
  return <span className={`badge badge-severity ${cls}`}>{severity}</span>;
}

function ReportModal({ hazardId, onClose }) {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/ai/report/${hazardId}`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => { setReport(d.report || "Failed to generate report."); setLoading(false); })
      .catch(() => { setReport("Failed to generate report."); setLoading(false); });
  }, [hazardId]);

  function copyReport() {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">✦ AI-Generated Authority Report</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">Generating report with AI...</div>
          ) : (
            <pre className="modal-report">{report}</pre>
          )}
        </div>
        {!loading && (
          <div className="modal-footer">
            <button className="modal-copy-btn" onClick={copyReport}>
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            <span className="modal-hint">Paste this into an email to your municipal authority.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((user) => { if (user) setCurrentUser(user); })
      .catch(() => {});
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    setCurrentUser(null);
  }

  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  const [userLocation, setUserLocation] = useState(null);
  const [nearMeRadius, setNearMeRadius] = useState(5);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const [reportModal, setReportModal] = useState(null);
  const [detailHazardId, setDetailHazardId] = useState(null);
  const detailHazard = detailHazardId ? hazards.find((h) => h.id === detailHazardId) ?? null : null;
  const [openComments, setOpenComments] = useState(new Set());
  const [copied, setCopied] = useState(null); // hazard id that was just shared
  const [upvotedIds, setUpvotedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("upvotedIds") || "[]")); }
    catch { return new Set(); }
  });

  useEffect(() => {
    fetch(`${API_URL}/api/hazards`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => { setHazards(data); setLoading(false); })
      .catch(() => { setError("Could not load hazards"); setLoading(false); });
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/hazards/stream`);
    es.addEventListener("hazard-created", (e) => {
      const hazard = JSON.parse(e.data);
      setHazards((prev) => prev.some((h) => h.id === hazard.id) ? prev : [hazard, ...prev]);
    });
    es.addEventListener("hazard-updated", (e) => {
      const hazard = JSON.parse(e.data);
      setHazards((prev) => prev.map((h) => (h.id === hazard.id ? hazard : h)));
    });
    es.addEventListener("hazard-deleted", (e) => {
      const { id } = JSON.parse(e.data);
      setHazards((prev) => prev.filter((h) => h.id !== id));
    });
    return () => es.close();
  }, []);

  function handleHazardAdded(newHazard) {
    setHazards((prev) => prev.some((h) => h.id === newHazard.id) ? prev : [newHazard, ...prev]);
  }

  async function updateHazardStatus(id, newStatus) {
    try {
      const res = await fetch(`${API_URL}/api/hazards/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const updated = await res.json();
      setHazards((prev) => prev.map((h) => (h.id === id ? updated : h)));
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  async function upvoteHazard(id) {
    const alreadyVoted = upvotedIds.has(id);
    try {
      const endpoint = alreadyVoted ? "unvote" : "upvote";
      const res = await fetch(`${API_URL}/api/hazards/${id}/${endpoint}`, { method: "PATCH" });
      const updated = await res.json();
      setHazards((prev) => prev.map((h) => (h.id === id ? updated : h)));
      setUpvotedIds((prev) => {
        const next = new Set(prev);
        alreadyVoted ? next.delete(id) : next.add(id);
        localStorage.setItem("upvotedIds", JSON.stringify([...next]));
        return next;
      });
    } catch (err) {
      console.error("Failed to upvote:", err);
    }
  }

  async function deleteHazard(id) {
    if (!confirm("Delete this hazard report?")) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/hazards/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setHazards((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  function toggleNearMe() {
    if (userLocation) {
      setUserLocation(null);
      setLocationError("");
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }
    setLocationLoading(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => {
        setLocationError("Location access denied");
        setLocationLoading(false);
      },
      { timeout: 8000 }
    );
  }

  async function toggleRecurring(id) {
    try {
      const res = await fetch(`${API_URL}/api/hazards/${id}/recurring`, { method: "PATCH" });
      const updated = await res.json();
      setHazards((prev) => prev.map((h) => (h.id === id ? updated : h)));
    } catch (err) {
      console.error("Failed to toggle recurring:", err);
    }
  }

  function toggleComments(id) {
    setOpenComments((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function shareHazard(id) {
    const url = `${window.location.origin}${window.location.pathname}#hazard-${id}`;
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function exportCSV() {
    const headers = ["ID", "Title", "Type", "City", "Area", "Status", "Severity", "Upvotes", "Reporter", "Recurring", "Reported On"];
    const rows = hazards.map((h) => [
      h.id,
      `"${h.title.replace(/"/g, '""')}"`,
      h.type,
      h.city,
      h.area || "",
      h.status,
      h.severity,
      h.upvotes,
      h.reporterName || "Anonymous",
      h.isRecurring ? "Yes" : "No",
      new Date(h.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raastareport-hazards.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = useMemo(() => ({
    total:      hazards.length,
    reported:   hazards.filter((h) => h.status === "Reported").length,
    inProgress: hazards.filter((h) => h.status === "In Progress").length,
    fixed:      hazards.filter((h) => h.status === "Fixed").length,
  }), [hazards]);

  const hazardTypes = useMemo(
    () => ["All", ...new Set(hazards.map((h) => h.type).filter(Boolean))],
    [hazards]
  );

  const displayed = useMemo(() => {
    let list = hazards.filter((h) => {
      if (filterStatus !== "All" && h.status !== filterStatus) return false;
      if (filterType !== "All" && h.type !== filterType) return false;
      if (filterSeverity !== "All" && h.severity !== filterSeverity) return false;
      if (userLocation) {
        if (!h.latitude || !h.longitude) return false;
        if (haversineKm(userLocation.lat, userLocation.lng, h.latitude, h.longitude) > nearMeRadius) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          h.title.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          (h.area && h.area.toLowerCase().includes(q)) ||
          h.city.toLowerCase().includes(q)
        );
      }
      return true;
    });
    if (sortBy === "newest") list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sortBy === "oldest") list = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (sortBy === "upvotes") list = [...list].sort((a, b) => b.upvotes - a.upvotes);
    return list;
  }, [hazards, search, filterStatus, filterType, filterSeverity, sortBy, userLocation, nearMeRadius]);

  const [appLoadTime] = useState(Date.now);

  // Trending: top 3 most upvoted in last 7 days, unresolved
  const trending = useMemo(() => {
    const cutoff = appLoadTime - 7 * 24 * 60 * 60 * 1000;
    return [...hazards]
      .filter((h) => h.status !== "Fixed" && new Date(h.createdAt) > cutoff)
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, 3);
  }, [hazards, appLoadTime]);

  // Leaderboard: areas ranked by unresolved hazard count
  const leaderboard = useMemo(() => {
    const counts = {};
    hazards
      .filter((h) => h.status !== "Fixed" && h.area)
      .forEach((h) => { counts[h.area] = (counts[h.area] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [hazards]);

  return (
    <>
      <Navbar currentUser={currentUser} onLoginClick={() => setShowAuthModal(true)} onLogout={handleLogout} />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onAuth={setCurrentUser} />}

      <main className="app">

        {/* HERO */}
        <section className="hero">
          <div className="hero-content">
            <h1>Safer Roads Start With <span>You</span></h1>
            <p>
              Help improve your city by reporting potholes, broken traffic lights,
              open manholes, and other road hazards.
            </p>
            <a href="#report-form" className="hero-button">Report a Hazard</a>
          </div>
        </section>

        {/* STATS BAR */}
        {!loading && !error && (
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Total Reports</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value stat-reported">{stats.reported}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value stat-progress">{stats.inProgress}</span>
              <span className="stat-label">In Progress</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-value stat-fixed">{stats.fixed}</span>
              <span className="stat-label">Fixed</span>
            </div>
          </div>
        )}

        {/* REPORT FORM */}
        <div id="report-form">
          <HazardForm onHazardAdded={handleHazardAdded} />
        </div>

        {/* MAP */}
        <section>
          <h2>Hazards Map</h2>
          <HazardMap hazards={hazards} onMarkerClick={(id) => setDetailHazardId(id)} />
        </section>

        {/* TRENDING */}
        {!loading && !error && trending.length > 0 && (
          <section className="trending-section">
            <h2>Trending This Week</h2>
            <div className="trending-list">
              {trending.map((h) => (
                <div key={h.id} className="trending-card" data-status={h.status}>
                  <div className="trending-upvotes">▲ {h.upvotes}</div>
                  <div className="trending-info">
                    <span className="trending-title">{h.title}</span>
                    <span className="trending-location">
                      {[h.area, h.city].filter(Boolean).join(", ")}
                    </span>
                  </div>
                  <SeverityBadge severity={h.severity} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* LEADERBOARD */}
        {!loading && !error && leaderboard.length > 0 && (
          <section className="leaderboard-section">
            <h2>Most Affected Areas</h2>
            <div className="leaderboard-list">
              {leaderboard.map(([area, count], i) => (
                <div key={area} className="leaderboard-item">
                  <span className="leaderboard-rank">#{i + 1}</span>
                  <span className="leaderboard-area">{area}</span>
                  <div className="leaderboard-bar-wrap">
                    <div
                      className="leaderboard-bar"
                      style={{ width: `${(count / leaderboard[0][1]) * 100}%` }}
                    />
                  </div>
                  <span className="leaderboard-count">{count} unresolved</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* REPORT LIST */}
        <section className="reports-section" id="reports">
          <h2>Recent Reports</h2>

          {!loading && !error && (
            <div className="filter-bar">
              <input
                className="filter-search"
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Reported">Reported</option>
                <option value="In Progress">In Progress</option>
                <option value="Fixed">Fixed</option>
              </select>
              <select className="filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                {hazardTypes.map((t) => (
                  <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
                ))}
              </select>
              <select className="filter-select" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                <option value="All">All Severities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="upvotes">Most Upvoted</option>
              </select>
              <button
                className={`near-me-btn${userLocation ? " near-me-btn--active" : ""}`}
                onClick={toggleNearMe}
                disabled={locationLoading}
                title={userLocation ? "Clear near me filter" : "Show hazards near my location"}
              >
                📍 {locationLoading ? "Locating..." : userLocation ? "Near Me ✕" : "Near Me"}
              </button>
              {userLocation && (
                <select className="filter-select" value={nearMeRadius} onChange={(e) => setNearMeRadius(Number(e.target.value))}>
                  <option value={1}>Within 1 km</option>
                  <option value={2}>Within 2 km</option>
                  <option value={5}>Within 5 km</option>
                  <option value={10}>Within 10 km</option>
                  <option value={20}>Within 20 km</option>
                </select>
              )}
              {locationError && <span className="location-error">{locationError}</span>}
              <button className="export-btn" onClick={exportCSV} title="Export all reports as CSV">
                ↓ Export CSV
              </button>
            </div>
          )}

          {loading && <p className="state-msg">Loading hazards...</p>}
          {error && <p className="state-msg state-error">{error}</p>}
          {!loading && !error && displayed.length === 0 && (
            <p className="state-msg">No reports match your filters.</p>
          )}

          {!loading && !error && (
            <div className="hazard-list">
              {displayed.map((hazard) => {
                const age = daysSince(hazard.createdAt);
                const isAging = hazard.status !== "Fixed" && age >= 30;
                const commentCount = hazard._count?.comments ?? 0;

                return (
                  <div
                    id={`hazard-${hazard.id}`}
                    className={`hazard-card ${hazard.status === "Fixed" ? "hazard-card--fixed" : ""}`}
                    data-status={hazard.status}
                    key={hazard.id}
                  >
                    {hazard.imageUrl && (
                      <img
                        src={`${API_URL}${hazard.imageUrl}`}
                        alt={hazard.title}
                        className="hazard-card-photo"
                      />
                    )}

                    <div className="hazard-card-body">
                      <div className="hazard-card-header">
                        <h3
                          className="hazard-card-title"
                          onClick={() => setDetailHazardId(hazard.id)}
                          title="Click to view full details"
                        >{hazard.title}</h3>
                        <span className="hazard-card-time">{timeAgo(hazard.createdAt)}</span>
                      </div>

                      <div className="hazard-card-badges">
                        <span className="badge badge-type">{hazard.type}</span>
                        <span className={`badge ${
                          hazard.status === "Reported" ? "badge-status-reported"
                          : hazard.status === "In Progress" ? "badge-status-progress"
                          : "badge-status-fixed"
                        }`}>
                          {hazard.status}
                        </span>
                        <SeverityBadge severity={hazard.severity} />
                        {hazard.isRecurring && (
                          <span className="badge badge-recurring">↩ Recurring</span>
                        )}
                        {isAging && (
                          <span className="badge badge-aging">⏱ {age}d unresolved</span>
                        )}
                      </div>

                      <p className="hazard-card-location">
                        {[hazard.area, hazard.city].filter(Boolean).join(", ")}
                      </p>

                      {hazard.reporterName && (
                        <p className="hazard-card-reporter">Reported by {hazard.reporterName}</p>
                      )}

                      <p className="hazard-card-desc">{hazard.description}</p>

                      <div className="hazard-card-footer">
                        <button
                          className={`upvote-btn${upvotedIds.has(hazard.id) ? " upvote-btn--voted" : ""}`}
                          onClick={() => upvoteHazard(hazard.id)}
                          title={upvotedIds.has(hazard.id) ? "Click to undo upvote" : "I've seen this too"}
                        >
                          ▲ <span>{hazard.upvotes}</span>
                        </button>

                        <button
                          className="comments-btn"
                          onClick={() => toggleComments(hazard.id)}
                          title="View updates"
                        >
                          ✎ {commentCount > 0 ? commentCount : ""} Updates
                        </button>

                        <button
                          className="report-btn"
                          onClick={() => setReportModal(hazard.id)}
                          title="Generate authority complaint letter"
                        >
                          ✦ Report
                        </button>

                        <button
                          className={`recurring-btn ${hazard.isRecurring ? "recurring-btn--active" : ""}`}
                          onClick={() => toggleRecurring(hazard.id)}
                          title={hazard.isRecurring ? "Unmark as recurring" : "Mark as recurring issue"}
                        >
                          ↩
                        </button>

                        <button
                          className="share-btn"
                          onClick={() => shareHazard(hazard.id)}
                          title="Copy link to this report"
                        >
                          {copied === hazard.id ? "✓ Copied" : "⎘ Share"}
                        </button>

                        {currentUser && hazard.userId === currentUser.id && (
                          <button
                            className="delete-btn"
                            onClick={() => deleteHazard(hazard.id)}
                            title="Delete this report"
                          >
                            ✕
                          </button>
                        )}

                        <select
                          className="status-select"
                          value={hazard.status}
                          onChange={(e) => updateHazardStatus(hazard.id, e.target.value)}
                        >
                          <option value="Reported">Reported</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Fixed">Fixed</option>
                        </select>
                      </div>

                      {openComments.has(hazard.id) && (
                        <CommentsSection hazardId={hazard.id} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {reportModal && (
        <ReportModal
          hazardId={reportModal}
          onClose={() => setReportModal(null)}
        />
      )}

      {detailHazard && (
        <HazardDetailModal
          hazard={detailHazard}
          onClose={() => setDetailHazardId(null)}
          upvotedIds={upvotedIds}
          onUpvote={upvoteHazard}
          onStatusChange={updateHazardStatus}
          onToggleRecurring={toggleRecurring}
        />
      )}
    </>
  );
}

export default App;
