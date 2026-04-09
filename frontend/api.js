const BASE_URL = "https://pulseappv2-production.up.railway.app";

const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

export const api = {
  // ═══════════════════════════════════════════════
  // Auth
  // ═══════════════════════════════════════════════
  createUser: (data) =>
    fetch(`${BASE_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  login: (username, password) =>
    fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then((r) => r.json()),

  getMe: (token) =>
    fetch(`${BASE_URL}/users/me`, {
      headers: authHeaders(token),
    }).then((r) => r.json()),

  updateProfile: (token, data) =>
    fetch(`${BASE_URL}/users/me`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  getUserById: (token, userId) =>
    fetch(`${BASE_URL}/users/${userId}`, {
      headers: authHeaders(token),
    }).then((r) => r.json()),

  // ═══════════════════════════════════════════════
  // Location
  // ═══════════════════════════════════════════════
  updateLocation: (token, latitude, longitude) =>
    fetch(`${BASE_URL}/users/me/location`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ latitude, longitude }),
    }),

  // ═══════════════════════════════════════════════
  // DOWN TONIGHT - NEW
  // ═══════════════════════════════════════════════
  activateDownTonight: (token) =>
    fetch(`${BASE_URL}/users/me/down-tonight`, {
      method: "POST",
      headers: authHeaders(token),
    }).then((r) => r.json()),

  // ═══════════════════════════════════════════════
  // Nearby
  // ═══════════════════════════════════════════════
  getNearby: (token, latitude, longitude, radius_miles = 10) =>
    fetch(
      `${BASE_URL}/nearby?latitude=${latitude}&longitude=${longitude}&radius_miles=${radius_miles}`,
      { headers: authHeaders(token) }
    ).then((r) => r.json()),

  // ═══════════════════════════════════════════════
  // Proposals
  // ═══════════════════════════════════════════════
  sendProposal: (token, receiverId, activity_tag, message = "") =>
    fetch(`${BASE_URL}/propose`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ receiver_id: receiverId, activity_tag, message }),
    }).then((r) => r.json()),

  getInbox: (token) =>
    fetch(`${BASE_URL}/proposals/inbox`, {
      headers: authHeaders(token),
    }).then((r) => r.json()),

  getSent: (token) =>
    fetch(`${BASE_URL}/proposals/sent`, {
      headers: authHeaders(token),
    }).then((r) => r.json()),

  respondToProposal: (token, proposalId, accept) =>
    fetch(`${BASE_URL}/proposals/${proposalId}/respond`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ accept }),
    }).then((r) => r.json()),

  // ═══════════════════════════════════════════════
  // Messages
  // ═══════════════════════════════════════════════
  getMessages: (token, proposalId) =>
    fetch(`${BASE_URL}/proposals/${proposalId}/messages`, {
      headers: authHeaders(token),
    }).then((r) => r.json()),

  sendMessage: (token, proposalId, content) =>
    fetch(`${BASE_URL}/proposals/${proposalId}/messages`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ content }),
    }).then((r) => r.json()),
};
