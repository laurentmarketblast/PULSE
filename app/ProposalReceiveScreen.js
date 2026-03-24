import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Animated, Dimensions, StatusBar, ActivityIndicator, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api";
import { useUser } from "../context/UserContext";

const { width, height } = Dimensions.get("window");

export default function ProposalReceiveScreen({ proposal, onBack, onResponded }) {
  const { token }       = useUser();
  const [responding, setResponding] = useState(false);

  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // We may have sender info passed in or just the proposal
  const senderName  = proposal._senderName  || "Someone";
  const senderPhoto = proposal._senderPhoto || null;
  const senderAge   = proposal._senderAge   || null;
  const senderDist  = proposal._senderDist  || null;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: height, duration: 280, useNativeDriver: true }).start(onBack);
  };

  const respond = async (accept) => {
    setResponding(true);
    try {
      const result = await api.respondToProposal(token, proposal.id, accept);
      if (result.id) {
        if (accept) {
          Alert.alert("Matched 🔥", "You can now message each other.", [
            { text: "OK", onPress: () => onResponded(result, true) },
          ]);
        } else {
          onResponded(result, false);
        }
      } else {
        Alert.alert("Error", result.detail || "Could not respond.");
        setResponding(false);
      }
    } catch {
      Alert.alert("Error", "Network error.");
      setResponding(false);
    }
  };

  return (
    <Animated.View style={[s.root, { transform: [{ translateY: slideAnim }] }]}>
      <StatusBar barStyle="light-content" />

      {/* Background photo */}
      {senderPhoto ? (
        <Image source={{ uri: senderPhoto }} style={s.bgPhoto} resizeMode="cover" />
      ) : (
        <View style={s.bgFallback} />
      )}

      {/* Gradients */}
      <LinearGradient
        colors={["rgba(0,0,0,0.5)", "transparent"]}
        style={s.topGrad}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.75)", "rgba(0,0,0,0.98)"]}
        style={s.bottomGrad}
        pointerEvents="none"
      />

      {/* Back */}
      <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.8}>
        <Text style={s.backText}>✕</Text>
      </TouchableOpacity>

      {/* Sender info — top */}
      <Animated.View style={[s.top, { opacity: fadeAnim }]} pointerEvents="none">
        <Text style={s.fromLabel}>PROPOSAL FROM</Text>
        <Text style={s.name}>{senderName}</Text>
        <View style={s.metaRow}>
          {senderAge  && <Text style={s.meta}>{senderAge}</Text>}
          {senderDist && <Text style={s.meta}>{senderDist} mi away</Text>}
        </View>
      </Animated.View>

      {/* Message + actions — bottom */}
      <Animated.View style={[s.bottom, { opacity: fadeAnim }]}>

        {/* The message */}
        <View style={s.messageCard}>
          <Text style={s.messageLabel}>THEIR MESSAGE</Text>
          <Text style={s.message}>
            {proposal.message || proposal.activity_tag || "No message"}
          </Text>
        </View>

        {/* Activity tag */}
        <View style={s.tagRow}>
          <View style={s.tag}>
            <Text style={s.tagText}>{proposal.activity_tag}</Text>
          </View>
        </View>

        {/* Accept / Decline */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.declineBtn}
            onPress={() => respond(false)}
            disabled={responding}
            activeOpacity={0.8}
          >
            <Text style={s.declineText}>✕  Pass</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.acceptWrap}
            onPress={() => respond(true)}
            disabled={responding}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#FF3C50", "#C0183B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.acceptBtn}
            >
              {responding
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.acceptText}>🔥  I'm Down</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#000", zIndex: 100,
  },
  bgPhoto: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
  },
  bgFallback: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#111",
  },
  topGrad: {
    position: "absolute", top: 0, left: 0, right: 0, height: height * 0.35, zIndex: 1,
  },
  bottomGrad: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: height * 0.7, zIndex: 1,
  },

  backBtn: {
    position: "absolute", top: 56, left: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  backText: { color: "#fff", fontSize: 16 },

  top: {
    position: "absolute", top: 60, left: 0, right: 0,
    paddingHorizontal: 28, zIndex: 5, alignItems: "center",
  },
  fromLabel: {
    color: "rgba(255,255,255,0.4)", fontSize: 10,
    letterSpacing: 3, marginBottom: 8,
  },
  name: {
    color: "#fff", fontSize: 42, fontWeight: "900",
    letterSpacing: -1, textAlign: "center",
  },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 6 },
  meta: { color: "rgba(255,255,255,0.4)", fontSize: 14 },

  bottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 44, zIndex: 5,
  },

  messageCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20, marginBottom: 14,
  },
  messageLabel: {
    color: "rgba(255,255,255,0.3)", fontSize: 9,
    letterSpacing: 2, marginBottom: 10,
  },
  message: {
    color: "#fff", fontSize: 20, lineHeight: 28,
    fontWeight: "500", fontStyle: "italic",
  },

  tagRow: { flexDirection: "row", marginBottom: 20 },
  tag: {
    borderWidth: 1, borderColor: "rgba(255,60,80,0.5)",
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: "rgba(255,60,80,0.12)",
  },
  tagText: { color: "#FF3C50", fontSize: 13, fontWeight: "600" },

  actions: { flexDirection: "row", gap: 12 },
  declineBtn: {
    flex: 1, paddingVertical: 18,
    borderRadius: 14, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center", justifyContent: "center",
  },
  declineText: { color: "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: 15 },

  acceptWrap: { flex: 2, borderRadius: 14, overflow: "hidden" },
  acceptBtn:  { paddingVertical: 18, alignItems: "center", justifyContent: "center" },
  acceptText: { color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: 0.3 },
});
