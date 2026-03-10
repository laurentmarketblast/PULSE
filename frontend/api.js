const BASE_URL = "http://192.168.1.179:8000";

export const api = {
  createUser: (data) =>
    fetch(`${BASE_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  updateLocation: (userId, latitude, longitude) =>
    fetch(`${BASE_URL}/users/${userId}/location`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
    }),

  getNearby: (latitude, longitude, userId, radius_miles = 10) =>
    fetch(`${BASE_URL}/nearby?latitude=${latitude}&longitude=${longitude}&user_id=${userId}&radius_miles=${radius_miles}`)
      .then((r) => r.json()),

  sendProposal: (senderId, receiverId, activity_tag, message = "") =>
    fetch(`${BASE_URL}/propose?sender_id=${senderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver_id: receiverId, activity_tag, message }),
    }).then((r) => r.json()),

  getInbox: (userId) =>
    fetch(`${BASE_URL}/proposals/inbox?user_id=${userId}`).then((r) => r.json()),

  getSent: (userId) =>
    fetch(`${BASE_URL}/proposals/sent?user_id=${userId}`).then((r) => r.json()),

  respondToProposal: (proposalId, accept) =>
    fetch(`${BASE_URL}/proposals/${proposalId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    }).then((r) => r.json()),

  getMessages: (proposalId, userId) =>
    fetch(`${BASE_URL}/proposals/${proposalId}/messages?user_id=${userId}`)
      .then((r) => r.json()),

  sendMessage: (proposalId, senderId, content) =>
    fetch(`${BASE_URL}/proposals/${proposalId}/messages?sender_id=${senderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then((r) => r.json()),
};
