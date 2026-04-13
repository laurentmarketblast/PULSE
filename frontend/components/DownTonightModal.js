import React, { useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "../context/UserContext";
import { api } from "../api";

export default function DownTonightModal({ visible, onClose }) {
  const { token, activateDownTonight } = useUser();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handlePurchase = async () => {
    try {
      // TODO: Add RevenueCat payment here
      // For now, just activate directly (free during development)
      
      // Call backend to activate
      await api.activateDownTonight(token);
      
      // Update local state
      activateDownTonight();
      
      // Close modal and show success
      onClose();
      Alert.alert("🔥 You're Down Tonight!", "Your profile is boosted for 8 hours.");
    } catch (err) {
      Alert.alert("Error", err.message || "Could not activate Down Tonight");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.handle} />
          <View style={s.iconWrap}>
            <Animated.View style={[s.iconRing,  { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[s.iconRing2, { transform: [{ scale: pulseAnim }], opacity: 0.25 }]} />
            <Text style={s.iconEmoji}>🔥</Text>
          </View>
          <Text style={s.title}>Down Tonight</Text>
          <Text style={s.subtitle}>Your profile jumps to the top of everyone nearby with a live pulse ring. They know you're available <Text style={s.subtitleBold}>right now.</Text></Text>
          {[
            { icon: "⏰", text: "Pinned to top of nearby for 8 hours" },
            { icon: "🎯", text: "Animated pulse ring around your card" },
            { icon: "🔴", text: "Live \"Down Tonight\" badge on your profile" },
            { icon: "⭐️", text: "Auto-expires — no recurring charge" },
          ].map((p, i) => (
            <View key={i} style={s.perk}>
              <Text style={s.perkIcon}>{p.icon}</Text>
              <Text style={s.perkText}>{p.text}</Text>
            </View>
          ))}
          <TouchableOpacity style={s.buyBtn} onPress={handlePurchase} activeOpacity={0.85}>
            <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.buyBtnGrad}>
              <Text style={s.buyBtnPrice}>$1.99</Text>
              <Text style={s.buyBtnLabel}>Activate for 8 hours</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={s.disclaimer}>One-time charge · Expires automatically · Not a subscription</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.88)" },
  sheet: { backgroundColor: "#080808", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: "#1a1a1a", padding: 28, paddingBottom: 44 },
  handle: { width: 36, height: 4, backgroundColor: "#1e1e1e", borderRadius: 2, alignSelf: "center", marginBottom: 28 },
  iconWrap: { alignSelf: "center", width: 80, height: 80, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  iconRing: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: "#FF3C50", opacity: 0.5 },
  iconRing2: { position: "absolute", width: 108, height: 108, borderRadius: 54, borderWidth: 1.5, borderColor: "#FF3C50" },
  iconEmoji: { fontSize: 36 },
  title: { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.5, marginBottom: 12 },
  subtitle: { color: "#555", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 28 },
  subtitleBold: { color: "#FF3C50", fontWeight: "700" },
  perk: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  perkIcon: { fontSize: 18, width: 28, textAlign: "center" },
  perkText: { color: "#777", fontSize: 14, flex: 1 },
  buyBtn: { borderRadius: 14, overflow: "hidden", marginTop: 16, marginBottom: 14 },
  buyBtnGrad: { paddingVertical: 20, alignItems: "center" },
  buyBtnPrice: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  buyBtnLabel: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 3 },
  disclaimer: { color: "#252525", fontSize: 11, textAlign: "center" },
});
