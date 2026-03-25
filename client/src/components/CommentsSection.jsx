import { useEffect, useState } from "react";
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

function CommentsSection({ hazardId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/hazards/${hazardId}/comments`)
      .then((r) => r.json())
      .then((data) => { setComments(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hazardId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/hazards/${hazardId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, author }),
      });
      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setText("");
    } catch {
      // silent fail
    }
    setSubmitting(false);
  }

  async function handleDelete(commentId) {
    await fetch(`${API_URL}/api/hazards/${hazardId}/comments/${commentId}`, {
      method: "DELETE",
    });
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="comments-section">
      {loading ? (
        <p className="comments-loading">Loading updates...</p>
      ) : (
        <>
          {comments.length === 0 && (
            <p className="comments-empty">No updates yet. Be the first to add one.</p>
          )}
          <div className="comments-list">
            {comments.map((c) => (
              <div key={c.id} className="comment-item">
                <div className="comment-meta">
                  <span className="comment-author">{c.author}</span>
                  <span className="comment-time">{timeAgo(c.createdAt)}</span>
                  <button
                    className="comment-delete"
                    onClick={() => handleDelete(c.id)}
                    title="Remove update"
                  >
                    ✕
                  </button>
                </div>
                <p className="comment-text">{c.text}</p>
              </div>
            ))}
          </div>
          <form className="comment-form" onSubmit={handleSubmit}>
            <input
              className="comment-author-input"
              type="text"
              placeholder="Your name (optional)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
            <textarea
              className="comment-text-input"
              placeholder="Add an update or observation..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
            />
            <button
              type="submit"
              className="comment-submit"
              disabled={submitting || !text.trim()}
            >
              {submitting ? "Posting..." : "Post Update"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default CommentsSection;
