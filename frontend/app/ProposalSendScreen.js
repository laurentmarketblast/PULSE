import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Image, TextInput,
  TouchableOpacity, Animated, Dimensions,
  ActivityIndicator, StatusBar, Alert, Keyboard, Platform, KeyboardAvoidingView
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api";
import { useUser } from "../context/UserContext";

const { width, height } = Dimensions.get("window");

const PHOTO_HEIGHT_FULL    = height * 0.52;
const PHOTO_HEIGHT_COMPACT = height * 0.22;

function SentOverlay({ person, onDone }) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacAnim  = useRef(new Animated.Value(0)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ])).start();
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);

  const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpac  = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <Animated.View style={[so.root, { opacity: opacAnim }]}>
      <Animated.View style={[so.card, { transform: [{ scale: scaleAnim }] }]}>
        <View style={so.iconWrap}>
          <Animated.View style={[so.ring, { transform: [{ scale: ringScale }], opacity: ringOpac }]} />
          <Text style={so.icon}>🔥</Text>
        </View>
        <Text style={so.title}>Proposal Sent</Text>
        <Text style={so.sub}>to {person.display_name}</Text>
        <Text style={so.hint}>You'll get notified when they respond</Text>
      </Animated.View>
    </Animated.View>
  );
}

const so = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center", zIndex: 999 },
  card: { alignItems: "center", gap: 12 },
  iconWrap: { width: 100, height: 100, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  ring: { position: "absolute", width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: "#FF3C50" },
  icon: { fontSize: 48 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  sub: { color: "#FF3C50", fontSize: 16, fontWeight: "600" },
  hint: { color: "#444", fontSize: 13, letterSpacing: 0.3, marginTop: 4 },
});

export default function ProposalSendScreen({ person, onBack, onSent }) {
  const { token } = useUser();
  const [message, setMessage]       = useState("");
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);

  const slideAnim    = useRef(new Animated.Value(height)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const photoHeight  = useRef(new Animated.Value(PHOTO_HEIGHT_FULL)).current;
  const nameScale    = useRef(new Animated.Value(1)).current;
  const nameTop      = useRef(new Animated.Value(height * 0.32)).current;
  const inputOpacity = useRef(new Animated.Value(0)).current;

  const allPhotos = [
    ...(person.avatar_url ? [person.avatar_url] : []),
    ...(person.photo_urls || []),
  ].filter(Boolean);
  const bgPhoto = allPhotos[0] || null;

  // Fast slide-in — timing instead of spring
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start(() => {
      Animated.timing(inputOpacity, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    });
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const duration  = Platform.OS === "ios" ? 280 : 200;

    const onShow = () => {
      setKeyboardUp(true);
      Animated.parallel([
        Animated.timing(photoHeight, { toValue: PHOTO_HEIGHT_COMPACT, duration, useNativeDriver: false }),
        Animated.timing(nameScale,   { toValue: 0.75,   duration, useNativeDriver: false }),
        Animated.timing(nameTop,     { toValue: PHOTO_HEIGHT_COMPACT - 85, duration, useNativeDriver: false }),
      ]).start();
    };

    const onHide = () => {
      setKeyboardUp(false);
      Animated.parallel([
        Animated.timing(photoHeight, { toValue: PHOTO_HEIGHT_FULL, duration, useNativeDriver: false }),
        Animated.timing(nameScale,   { toValue: 1,      duration, useNativeDriver: false }),
        Animated.timing(nameTop,     { toValue: height * 0.32, duration, useNativeDriver: false }),
      ]).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const handleBack = () => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, { toValue: height, duration: 240, useNativeDriver: true }).start(onBack);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert("Say something", "Write a message with your proposal.");
      return;
    }
    setSending(true);
    try {
      const result = await api.sendProposal(
        token, person.id,
        person.shared_tags?.[0] || "hangout",
        message.trim()
      );
      if (result.id) {
        Keyboard.dismiss();
        setSent(true);
      } else {
        Alert.alert("Error", result.detail || "Could not send.");
        setSending(false);
      }
    } catch {
      Alert.alert("Error", "Network error.");
      setSending(false);
    }
  };

  return (
    <Animated.View style={[s.root, { transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" />

      {/* Photo */}
      <Animated.View style={[s.photoWrap, { height: photoHeight }]}>
        {bgPhoto
          ? <Image source={{ uri: bgPhoto }} style={s.photo} resizeMode="cover" />
          : <View style={s.photoFallback} />
        }
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", "transparent", "rgba(0,0,0,0.85)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      {/* Name */}
      <Animated.View style={[s.nameWrap, { top: nameTop, transform: [{ scale: nameScale }] }]} pointerEvents="none">
        <Text style={s.toLabel}>PROPOSAL TO</Text>
        <Text style={s.name}>{person.display_name}</Text>
        <View style={s.metaRow}>
          {person.age && <Text style={s.meta}>{person.age}</Text>}
          <Text style={s.meta}>{person.distance_miles} mi away</Text>
        </View>
      </Animated.View>

      {/* Back button */}
      <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.8}>
        <Text style={s.backText}>✕</Text>
      </TouchableOpacity>

      {/* Input section */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Animated.View style={[s.inputSection, { opacity: inputOpacity }]}>
          {person.shared_tags?.length > 0 && (
            <View style={s.tagsRow}>
              {person.shared_tags.map((t) => (
                <View key={t} style={s.tag}>
                  <Text style={s.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="What do you have in mind..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={300}
              selectionColor="#FF3C50"
              autoFocus
            />
            <Text style={s.charCount}>{message.length}/300</Text>
          </View>

          <TouchableOpacity style={s.sendWrap} onPress={handleSend} disabled={sending} activeOpacity={0.85}>
            <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sendBtn}>
              {sending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.sendText}>Send Proposal 🔥</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>

      {sent && (
        <SentOverlay person={person} onDone={() => { setSent(false); onSent(); }} />
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#080808", zIndex: 100, flexDirection: "column",
  },
  photoWrap: { width: "100%", overflow: "hidden", backgroundColor: "#111" },
  photo: { width: "100%", height: "100%" },
  photoFallback: { width: "100%", height: "100%", backgroundColor: "#111" },

  nameWrap: {
    position: "absolute", left: 0, right: 0,
    alignItems: "center", zIndex: 5, paddingHorizontal: 20,
  },
  toLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, letterSpacing: 3, marginBottom: 6 },
  name: { color: "#fff", fontSize: 42, fontWeight: "900", letterSpacing: -1, textAlign: "center" },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  meta: { color: "rgba(255,255,255,0.45)", fontSize: 14 },

  backBtn: {
    position: "absolute", top: 56, left: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  backText: { color: "#fff", fontSize: 16 },

  inputSection: {
    flex: 1, backgroundColor: "#080808",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  tag: {
    borderWidth: 1, borderColor: "rgba(255,60,80,0.5)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: "rgba(255,60,80,0.1)",
  },
  tagText: { color: "#FF3C50", fontSize: 12, fontWeight: "600" },

  inputWrap: {
    height: 140,
    backgroundColor: "#111", borderRadius: 16,
    borderWidth: 1, borderColor: "#1e1e1e",
    padding: 16, marginBottom: 14,
  },
  input: {
    flex: 1, color: "#fff", fontSize: 17,
    lineHeight: 25, textAlignVertical: "top",
  },
  charCount: { color: "#2a2a2a", fontSize: 11, textAlign: "right", marginTop: 6 },

  sendWrap: { borderRadius: 14, overflow: "hidden" },
  sendBtn:  { paddingVertical: 18, alignItems: "center" },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: 0.5 },
});
