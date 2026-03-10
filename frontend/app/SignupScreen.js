import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  Animated, Dimensions, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api";
import { useUser } from "../context/UserContext";

const { width, height } = Dimensions.get("window");

const TAGS = [
  "late nights", "drinks", "gym", "spontaneous",
  "coffee", "dancing", "travel", "art",
  "music", "food", "hiking", "gaming",
];

function PulseLogo() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={logo.container}>
      <Animated.View style={[logo.ring, logo.ring3, { transform: [{ scale: pulse }] }]} />
      <Animated.View style={[logo.ring, logo.ring2]} />
      <View style={logo.core} />
      <View style={[logo.bar, logo.bar1]} />
      <View style={[logo.bar, logo.bar2]} />
      <View style={[logo.bar, logo.bar3]} />
    </View>
  );
}

const logo = StyleSheet.create({
  container: { width: 64, height: 64, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1.5 },
  ring2: { width: 40, height: 40, borderColor: "rgba(255,60,80,0.4)" },
  ring3: { width: 60, height: 60, borderColor: "rgba(255,60,80,0.15)" },
  core: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#FF3C50" },
  bar: { position: "absolute", width: 2, backgroundColor: "#FF3C50", bottom: 6, borderRadius: 2 },
  bar1: { height: 8,  right: 8,  opacity: 0.4 },
  bar2: { height: 13, right: 13, opacity: 0.65 },
  bar3: { height: 18, right: 18, opacity: 0.9 },
});

const BASE_URL = "http://192.168.1.179:8000";

export default function SignupScreen() {
  const { setUser }                     = useUser();
  const [mode, setMode]                 = useState("signup"); // "signup" | "login"
  const [username, setUsername]         = useState("");
  const [displayName, setDisplayName]   = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [focused, setFocused]           = useState(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert("Enter your username");
      return;
    }
    setLoading(true);
    try {
      // Find user by username
      const res = await fetch(`${BASE_URL}/users/by-username/${username.trim().toLowerCase()}`);
      const data = await res.json();
      if (data.id) {
        setUser(data);
      } else {
        Alert.alert("Not found", "No account with that username. Check your spelling or sign up.");
      }
    } catch {
      Alert.alert("No connection", "Check that your server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!username.trim() || !displayName.trim() || selectedTags.length === 0) {
      Alert.alert("Not so fast", "Fill in your name and pick what you're down for.");
      return;
    }
    setLoading(true);
    try {
      const user = await api.createUser({
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        interest_tags: selectedTags,
      });
      if (user.id) {
        setUser(user);
      } else {
        Alert.alert("Hmm", user.detail || "Something went wrong.");
      }
    } catch {
      Alert.alert("No connection", "Check that your server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <View style={s.bgDot1} />
      <View style={s.bgDot2} />
      <View style={s.bgLine} />

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Logo */}
          <View style={s.header}>
            <PulseLogo />
            <Text style={s.wordmark}>PULSE</Text>
            <Text style={s.tagline}>who's around. who's down.</Text>
          </View>

          {/* Mode toggle */}
          <View style={s.modeToggle}>
            <TouchableOpacity
              style={[s.modeBtn, mode === "signup" && s.modeBtnActive]}
              onPress={() => setMode("signup")}
            >
              <Text style={[s.modeBtnText, mode === "signup" && s.modeBtnTextActive]}>New here</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, mode === "login" && s.modeBtnActive]}
              onPress={() => setMode("login")}
            >
              <Text style={[s.modeBtnText, mode === "login" && s.modeBtnTextActive]}>I have an account</Text>
            </TouchableOpacity>
          </View>

          {mode === "login" ? (
            // ── LOGIN ──
            <View>
              <View style={[s.inputWrap, focused === "user" && s.inputWrapFocused]}>
                <Text style={s.inputLabel}>USERNAME</Text>
                <TextInput
                  style={s.input}
                  placeholder="@handle"
                  placeholderTextColor="#3a3a3a"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  onFocus={() => setFocused("user")}
                  onBlur={() => setFocused(null)}
                  selectionColor="#FF3C50"
                />
              </View>

              <TouchableOpacity style={[s.ctaWrap, { marginTop: 24 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Log in</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            // ── SIGNUP ──
            <View>
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>create your profile</Text>
                <View style={s.dividerLine} />
              </View>

              <View style={s.inputs}>
                <View style={[s.inputWrap, focused === "name" && s.inputWrapFocused]}>
                  <Text style={s.inputLabel}>DISPLAY NAME</Text>
                  <TextInput
                    style={s.input}
                    placeholder="how you'll appear"
                    placeholderTextColor="#3a3a3a"
                    value={displayName}
                    onChangeText={setDisplayName}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    selectionColor="#FF3C50"
                  />
                </View>
                <View style={[s.inputWrap, focused === "user" && s.inputWrapFocused]}>
                  <Text style={s.inputLabel}>USERNAME</Text>
                  <TextInput
                    style={s.input}
                    placeholder="@handle"
                    placeholderTextColor="#3a3a3a"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    onFocus={() => setFocused("user")}
                    onBlur={() => setFocused(null)}
                    selectionColor="#FF3C50"
                  />
                </View>
              </View>

              <View style={s.tagSection}>
                <Text style={s.tagHeading}>I'M DOWN FOR</Text>
                <View style={s.tags}>
                  {TAGS.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <TouchableOpacity key={tag} style={[s.tag, active && s.tagActive]} onPress={() => toggleTag(tag)} activeOpacity={0.7}>
                        {active && <View style={s.tagGlow} />}
                        <Text style={[s.tagText, active && s.tagTextActive]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity style={s.ctaWrap} onPress={handleSignup} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Find who's nearby</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={s.legal}>
                By continuing you agree to be{" "}
                <Text style={{ color: "#FF3C50" }}>found.</Text>
              </Text>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808" },
  bgDot1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(255,60,80,0.06)", top: -80, right: -80 },
  bgDot2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,60,80,0.04)", bottom: 100, left: -60 },
  bgLine: { position: "absolute", width: 1, height: height, backgroundColor: "rgba(255,60,80,0.06)", left: width * 0.72, top: 0 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 28, paddingTop: 80, paddingBottom: 60 },
  header: { alignItems: "center", marginBottom: 36 },
  wordmark: { fontSize: 38, fontWeight: "900", color: "#fff", letterSpacing: 14, marginBottom: 8 },
  tagline: { fontSize: 13, color: "#444", letterSpacing: 2, textTransform: "uppercase" },
  modeToggle: { flexDirection: "row", backgroundColor: "#0e0e0e", borderRadius: 8, borderWidth: 1, borderColor: "#1a1a1a", overflow: "hidden", marginBottom: 28 },
  modeBtn: { flex: 1, paddingVertical: 13, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#FF3C50" },
  modeBtnText: { color: "#333", fontSize: 13, fontWeight: "600" },
  modeBtnTextActive: { color: "#fff" },
  divider: { flexDirection: "row", alignItems: "center", marginBottom: 28, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1c1c1c" },
  dividerText: { color: "#333", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  inputs: { gap: 12, marginBottom: 32 },
  inputWrap: { backgroundColor: "#0f0f0f", borderRadius: 4, borderWidth: 1, borderColor: "#1a1a1a", padding: 14 },
  inputWrapFocused: { borderColor: "#FF3C50", backgroundColor: "#100808" },
  inputLabel: { fontSize: 9, letterSpacing: 2, color: "#333", marginBottom: 6 },
  input: { color: "#fff", fontSize: 16, fontWeight: "500", padding: 0 },
  tagSection: { marginBottom: 36 },
  tagHeading: { fontSize: 9, letterSpacing: 2, color: "#333", marginBottom: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 2, borderWidth: 1, borderColor: "#1e1e1e", backgroundColor: "#0c0c0c", overflow: "hidden" },
  tagActive: { borderColor: "#FF3C50", backgroundColor: "#150508" },
  tagGlow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,60,80,0.08)" },
  tagText: { color: "#383838", fontSize: 13, fontWeight: "500", letterSpacing: 0.3 },
  tagTextActive: { color: "#FF3C50" },
  ctaWrap: { borderRadius: 4, overflow: "hidden", marginBottom: 20 },
  cta: { paddingVertical: 18, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  legal: { textAlign: "center", color: "#222", fontSize: 12, letterSpacing: 0.3 },
});
