import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { useUser } from "../context/UserContext";

export default function ProfileScreen() {
  const { user, setUser } = useUser();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.header}>Profile</Text>

      <View style={s.avatarCircle}>
        <Text style={s.avatarText}>{user?.display_name?.[0]?.toUpperCase()}</Text>
      </View>

      <Text style={s.name}>{user?.display_name}</Text>
      <Text style={s.username}>@{user?.username}</Text>

      {user?.bio ? <Text style={s.bio}>{user.bio}</Text> : null}

      <Text style={s.sectionLabel}>My Tags</Text>
      <View style={s.tags}>
        {(user?.interest_tags || []).map((tag) => (
          <View key={tag} style={s.tag}>
            <Text style={s.tagText}>{tag}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={() => setUser(null)}>
        <Text style={s.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#0D0D0D" },
  content:      { paddingTop: 70, paddingHorizontal: 24, alignItems: "center" },
  header:       { fontSize: 28, fontWeight: "900", color: "#fff", alignSelf: "flex-start", marginBottom: 32 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#FF2D55", justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  avatarText:   { color: "#fff", fontSize: 38, fontWeight: "900" },
  name:         { color: "#fff", fontSize: 24, fontWeight: "800" },
  username:     { color: "#555", fontSize: 15, marginTop: 4, marginBottom: 12 },
  bio:          { color: "#888", fontSize: 15, textAlign: "center", marginBottom: 24 },
  sectionLabel: { color: "#666", fontSize: 13, alignSelf: "flex-start", marginBottom: 10, marginTop: 8 },
  tags:         { flexDirection: "row", flexWrap: "wrap", gap: 8, alignSelf: "flex-start", marginBottom: 48 },
  tag: {
    backgroundColor: "#1a1a1a", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: "#2a2a2a",
  },
  tagText:      { color: "#FF2D55", fontWeight: "600", fontSize: 14 },
  logoutBtn: {
    borderWidth: 1, borderColor: "#333", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40,
  },
  logoutText:   { color: "#555", fontSize: 15 },
});
