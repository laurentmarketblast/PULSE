import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { api } from "../api";
import { useUser } from "../context/UserContext";

const AVAILABLE_TAGS = [
  "coffee", "drinks", "hiking", "gym", "food",
  "movies", "gaming", "music", "art", "study",
  "cycling", "yoga", "beach", "dancing", "travel",
];

export default function SignupScreen() {
  const { setUser } = useUser();
  const [username, setUsername]       = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio]                 = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading]         = useState(false);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSignup = async () => {
    if (!username || !displayName || selectedTags.length === 0) {
      Alert.alert("Missing info", "Fill in all fields and pick at least one tag.");
      return;
    }
    setLoading(true);
    try {
      const user = await api.createUser({
        username,
        display_name: displayName,
        bio,
        interest_tags: selectedTags,
      });
      if (user.id) {
        setUser(user);
      } else {
        Alert.alert("Error", user.detail || "Something went wrong.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.logo}>⚡ Pulse</Text>
      <Text style={s.subtitle}>Skip the small talk.</Text>

      <TextInput
        style={s.input}
        placeholder="Username"
        placeholderTextColor="#555"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={s.input}
        placeholder="Display Name"
        placeholderTextColor="#555"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={[s.input, { height: 80 }]}
        placeholder="Bio (optional)"
        placeholderTextColor="#555"
        value={bio}
        onChangeText={setBio}
        multiline
      />

      <Text style={s.label}>I'm down for...</Text>
      <View style={s.tags}>
        {AVAILABLE_TAGS.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={[s.tag, selectedTags.includes(tag) && s.tagActive]}
            onPress={() => toggleTag(tag)}
          >
            <Text style={[s.tagText, selectedTags.includes(tag) && s.tagTextActive]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={s.btn} onPress={handleSignup} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>Let's Go →</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#0D0D0D" },
  content:    { padding: 28, paddingTop: 80 },
  logo:       { fontSize: 42, fontWeight: "900", color: "#FF2D55", textAlign: "center" },
  subtitle:   { color: "#666", textAlign: "center", marginBottom: 36, fontSize: 16 },
  input: {
    backgroundColor: "#1a1a1a", color: "#fff",
    borderRadius: 12, padding: 16, marginBottom: 14, fontSize: 16,
  },
  label:      { color: "#aaa", marginBottom: 12, fontSize: 15, marginTop: 8 },
  tags:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 32 },
  tag: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "#333", backgroundColor: "#1a1a1a",
  },
  tagActive:     { backgroundColor: "#FF2D55", borderColor: "#FF2D55" },
  tagText:       { color: "#888", fontSize: 14 },
  tagTextActive: { color: "#fff", fontWeight: "700" },
  btn: {
    backgroundColor: "#FF2D55", borderRadius: 14,
    padding: 18, alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
});
