import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import * as Location from "expo-location";
import { api } from "../api";
import { useUser } from "../context/UserContext";

export default function NearbyScreen() {
  const { user } = useUser();
  const [nearby, setNearby]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null); // user to propose to
  const [tag, setTag]             = useState("");
  const [message, setMessage]     = useState("");
  const [sending, setSending]     = useState(false);

  const fetchNearby = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location needed", "Enable location to find people nearby.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      // Also update our location on the backend
      await api.updateLocation(user.id, latitude, longitude);

      const results = await api.getNearby(latitude, longitude);
      setNearby(Array.isArray(results) ? results : []);
    } catch (e) {
      Alert.alert("Error", "Could not fetch nearby users.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => { fetchNearby(); }, [fetchNearby]);

  const sendProposal = async () => {
    if (!tag) { Alert.alert("Pick an activity tag"); return; }
    setSending(true);
    try {
      const result = await api.sendProposal(selected.id, tag, message);
      if (result.id) {
        Alert.alert("⚡ Sent!", `Proposal sent to ${selected.display_name}. They have 60 min to respond.`);
        setSelected(null); setTag(""); setMessage("");
      } else {
        Alert.alert("Error", result.detail || "Could not send proposal.");
      }
    } catch {
      Alert.alert("Error", "Network error.");
    } finally {
      setSending(false);
    }
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity style={s.card} onPress={() => setSelected(item)}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{item.display_name[0].toUpperCase()}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.name}>{item.display_name}</Text>
        <Text style={s.distance}>📍 {item.distance_miles} mi away</Text>
        <View style={s.tags}>
          {item.shared_tags.map((t) => (
            <View key={t} style={s.sharedTag}>
              <Text style={s.sharedTagText}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={s.arrow}>→</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <Text style={s.header}>⚡ Nearby</Text>

      {loading ? (
        <ActivityIndicator color="#FF2D55" style={{ marginTop: 60 }} size="large" />
      ) : (
        <FlatList
          data={nearby}
          keyExtractor={(i) => i.id}
          renderItem={renderUser}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchNearby(); }}
              tintColor="#FF2D55"
            />
          }
          ListEmptyComponent={
            <Text style={s.empty}>No one nearby right now.{"\n"}Check back soon.</Text>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Propose Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>
              Propose to {selected?.display_name}
            </Text>

            <Text style={s.modalLabel}>Activity tag</Text>
            <View style={s.tagRow}>
              {(selected?.shared_tags || []).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.tagChip, tag === t && s.tagChipActive]}
                  onPress={() => setTag(t)}
                >
                  <Text style={[s.tagChipText, tag === t && { color: "#fff" }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={s.input}
              placeholder="Add a message (optional)"
              placeholderTextColor="#555"
              value={message}
              onChangeText={setMessage}
              maxLength={280}
            />

            <Text style={s.expire}>⏱ Expires in 60 minutes if not accepted</Text>

            <TouchableOpacity style={s.sendBtn} onPress={sendProposal} disabled={sending}>
              {sending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.sendBtnText}>Send Proposal ⚡</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={s.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#0D0D0D", paddingTop: 60, paddingHorizontal: 16 },
  header:      { fontSize: 28, fontWeight: "900", color: "#fff", marginBottom: 20 },
  card: {
    backgroundColor: "#1a1a1a", borderRadius: 16,
    padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center",
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#FF2D55", justifyContent: "center", alignItems: "center",
    marginRight: 14,
  },
  avatarText:  { color: "#fff", fontWeight: "900", fontSize: 20 },
  cardBody:    { flex: 1 },
  name:        { color: "#fff", fontWeight: "700", fontSize: 16 },
  distance:    { color: "#666", fontSize: 13, marginTop: 2 },
  tags:        { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  sharedTag: {
    backgroundColor: "#2a0a12", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  sharedTagText: { color: "#FF2D55", fontSize: 12, fontWeight: "600" },
  arrow:       { color: "#333", fontSize: 20 },
  empty:       { color: "#444", textAlign: "center", marginTop: 80, fontSize: 16, lineHeight: 26 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#141414", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 48,
  },
  modalTitle:  { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 20 },
  modalLabel:  { color: "#888", fontSize: 13, marginBottom: 8 },
  tagRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "#333",
  },
  tagChipActive: { backgroundColor: "#FF2D55", borderColor: "#FF2D55" },
  tagChipText:   { color: "#888", fontSize: 14 },
  input: {
    backgroundColor: "#1f1f1f", color: "#fff",
    borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 15,
  },
  expire:    { color: "#555", fontSize: 12, marginBottom: 20, textAlign: "center" },
  sendBtn: {
    backgroundColor: "#FF2D55", borderRadius: 14,
    padding: 16, alignItems: "center", marginBottom: 12,
  },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancel:      { color: "#555", textAlign: "center", fontSize: 15 },
});
