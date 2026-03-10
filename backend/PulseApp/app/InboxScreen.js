import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { api } from "../api";
import { useUser } from "../context/UserContext";

const STATUS_COLOR = {
  pending:  "#FF9500",
  accepted: "#30D158",
  declined: "#555",
  expired:  "#333",
};

const STATUS_LABEL = {
  pending:  "⏱ Pending",
  accepted: "✅ Accepted",
  declined: "❌ Declined",
  expired:  "💨 Expired",
};

function timeLeft(createdAt) {
  const expires = new Date(createdAt).getTime() + 60 * 60 * 1000;
  const diff    = expires - Date.now();
  if (diff <= 0) return "Expired";
  const m = Math.floor(diff / 60000);
  return `${m}m left`;
}

export default function InboxScreen() {
  const { user }                    = useUser();
  const [proposals, setProposals]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── NOTE ────────────────────────────────────────────────────────────────────
  // The backend doesn't yet have a GET /proposals/inbox endpoint.
  // We'll add it next. For now this screen is wired and ready.
  // ────────────────────────────────────────────────────────────────────────────
  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch(
        `http://192.168.1.X:8000/proposals/inbox?user_id=${user.id}`
      );
      const data = await res.json();
      setProposals(Array.isArray(data) ? data : []);
    } catch {
      // silently fail until backend endpoint is added
      setProposals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const respond = async (proposal, accept) => {
    try {
      const result = await api.respondToProposal(proposal.id, accept);
      if (result.id) {
        setProposals((prev) =>
          prev.map((p) => (p.id === proposal.id ? result : p))
        );
      }
    } catch {
      Alert.alert("Error", "Could not respond to proposal.");
    }
  };

  const renderItem = ({ item }) => {
    const isPending = item.status === "pending";
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>?</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.tag}>⚡ {item.activity_tag}</Text>
            {item.message ? (
              <Text style={s.message}>"{item.message}"</Text>
            ) : null}
            <Text style={[s.status, { color: STATUS_COLOR[item.status] }]}>
              {STATUS_LABEL[item.status]}
              {isPending ? `  ·  ${timeLeft(item.created_at)}` : ""}
            </Text>
          </View>
        </View>

        {isPending && (
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.btn, s.acceptBtn]}
              onPress={() => respond(item, true)}
            >
              <Text style={s.btnText}>Accept ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.declineBtn]}
              onPress={() => respond(item, false)}
            >
              <Text style={[s.btnText, { color: "#888" }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={s.container}>
      <Text style={s.header}>⚡ Inbox</Text>
      {loading ? (
        <ActivityIndicator color="#FF2D55" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchProposals(); }}
              tintColor="#FF2D55"
            />
          }
          ListEmptyComponent={
            <Text style={s.empty}>No proposals yet.{"\n"}Get out there! 🏃</Text>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#0D0D0D", paddingTop: 60, paddingHorizontal: 16 },
  header:     { fontSize: 28, fontWeight: "900", color: "#fff", marginBottom: 20 },
  card: {
    backgroundColor: "#1a1a1a", borderRadius: 16,
    padding: 16, marginBottom: 12,
  },
  cardTop:    { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#2a2a2a", justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#555", fontSize: 18 },
  tag:        { color: "#FF2D55", fontWeight: "800", fontSize: 16 },
  message:    { color: "#aaa", fontSize: 14, marginTop: 4, fontStyle: "italic" },
  status:     { fontSize: 13, marginTop: 6, fontWeight: "600" },
  actions:    { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1, padding: 12,
    borderRadius: 12, alignItems: "center",
  },
  acceptBtn:  { backgroundColor: "#FF2D55" },
  declineBtn: { backgroundColor: "#222" },
  btnText:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty:      { color: "#444", textAlign: "center", marginTop: 80, fontSize: 16, lineHeight: 26 },
});
