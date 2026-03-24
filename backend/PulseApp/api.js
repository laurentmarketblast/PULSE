// ─────────────────────────────────────────────
// Pulse API  — all backend calls in one place
// Change BASE_URL to your machine's local IP
// (find it with `ipconfig` on Windows)
// ─────────────────────────────────────────────

const BASE_URL = "http://25.18.233.44:8000"; // ← replace X with your IP

export const api = {
  // ── Users ──────────────────────────────────
  createUser: (data) =>
    fetch(`${BASE_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // ── Location ───────────────────────────────
  updateLocation: (userId, latitude, longitude) =>
    fetch(`${BASE_URL}/users/${userId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
    }),

  // ── Nearby ─────────────────────────────────
  getNearby: (latitude, longitude, radius_miles = 10) =>
    fetch(
      `${BASE_URL}/nearby?latitude=${latitude}&longitude=${longitude}&radius_miles=${radius_miles}`
    ).then((r) => r.json()),

  // ── Proposals ──────────────────────────────
  sendProposal: (receiver_id, activity_tag, message = "") =>
    fetch(`${BASE_URL}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver_id, activity_tag, message }),
    }).then((r) => r.json()),

  respondToProposal: (proposalId, accept) =>
    fetch(`${BASE_URL}/proposals/${proposalId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    }).then((r) => r.json()),
};
