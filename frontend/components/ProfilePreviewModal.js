import React, { useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Animated, Dimensions, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Avatar from "./Avatar";

const { width, height } = Dimensions.get("window");
const CARD_HEIGHT = height * 0.62;

export default function ProfilePreviewModal({ visible, user, onClose }) {
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 260, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!user) return null;

  const mainPhoto = user.avatar_url || user.photo_urls?.[0] || null;
  const extraPhotos = user.photo_urls?.slice(1) || [];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>

          <View style={s.handle} />

          <View style={s.header}>
            <Text style={s.headerLabel}>YOUR PROFILE</Text>
            <Text style={s.headerSub}>This is how others see you</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            {/* ── CARD ── */}
            <View style={s.card}>
              {/* Main photo hero */}
              <View style={s.cardHero}>
                {mainPhoto ? (
                  <Image source={{ uri: mainPhoto }} style={s.heroImage} resizeMode="cover" />
                ) : (
                  <LinearGradient
                    colors={["#1a0508", "#0e0e0e"]}
                    style={s.heroPlaceholder}
                  >
                    <Avatar uri={null} name={user.display_name} size={100} />
                  </LinearGradient>
                )}
                {/* Gradient overlay at bottom */}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.85)"]}
                  style={s.heroGradient}
                />
                {/* Name overlay */}
                <View style={s.heroInfo}>
                  <View style={s.heroNameRow}>
                    <Text style={s.heroName}>{user.display_name}</Text>
                    {user.age && <Text style={s.heroAge}>{user.age}</Text>}
                  </View>
                  {user.bio ? (
                    <Text style={s.heroBio} numberOfLines={2}>{user.bio}</Text>
                  ) : null}
                </View>
              </View>

              {/* Card body */}
              <View style={s.cardBody}>
                {/* Extra photos strip */}
                {extraPhotos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.photoStrip} contentContainerStyle={{ gap: 8 }}>
                    {extraPhotos.map((uri, i) => (
                      <Image key={i} source={{ uri }} style={s.extraPhoto} resizeMode="cover" />
                    ))}
                  </ScrollView>
                )}

                {/* Info chips */}
                <View style={s.chips}>
                  {user.looking_for && (
                    <View style={s.chip}>
                      <Text style={s.chipIcon}>🔥</Text>
                      <View>
                        <Text style={s.chipLabel}>LOOKING FOR</Text>
                        <Text style={s.chipValue}>{user.looking_for}</Text>
                      </View>
                    </View>
                  )}
                  {user.sexuality && (
                    <View style={s.chip}>
                      <Text style={s.chipIcon}>✦</Text>
                      <View>
                        <Text style={s.chipLabel}>SEXUALITY</Text>
                        <Text style={s.chipValue}>{user.sexuality}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Tags */}
                {user.interest_tags?.length > 0 && (
                  <View style={s.tagsSection}>
                    <Text style={s.tagsLabel}>DOWN FOR</Text>
                    <View style={s.tags}>
                      {user.interest_tags.map((tag) => (
                        <View key={tag} style={s.tag}>
                          <Text style={s.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* ── PROFILE STRENGTH ── */}
            <View style={s.strengthCard}>
              <Text style={s.strengthLabel}>PROFILE STRENGTH</Text>
              <View style={s.strengthBar}>
                <Animated.View style={[s.strengthFill, { width: `${getCompletionScore(user)}%` }]} />
              </View>
              <View style={s.strengthRow}>
                <Text style={s.strengthPct}>{getCompletionScore(user)}%</Text>
                {getCompletionScore(user) < 100 && (
                  <Text style={s.strengthTip}>{getCompletionTip(user)}</Text>
                )}
              </View>
            </View>

          </ScrollView>

          <TouchableOpacity style={s.doneBtn} onPress={onClose}>
            <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.doneBtnGradient}>
              <Text style={s.doneBtnText}>Looks good ✓</Text>
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

function getCompletionScore(user) {
  let score = 0;
  if (user.display_name) score += 20;
  if (user.avatar_url || user.photo_urls?.length > 0) score += 20;
  if (user.bio) score += 20;
  if (user.looking_for) score += 20;
  if (user.interest_tags?.length > 0) score += 20;
  return score;
}

function getCompletionTip(user) {
  if (!user.bio) return "Add a bio — profiles with bios get 3x more proposals";
  if (!user.looking_for) return "Set what you're looking for";
  if (!user.avatar_url && !user.photo_urls?.length) return "Add at least one photo";
  return "Almost there!";
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  sheet: {
    backgroundColor: "#080808",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: "#1a1a1a",
    maxHeight: height * 0.94,
  },
  handle: { width: 36, height: 4, backgroundColor: "#1e1e1e", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },

  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderColor: "#0e0e0e", position: "relative" },
  headerLabel: { color: "#FF3C50", fontSize: 10, letterSpacing: 3, marginBottom: 2 },
  headerSub: { color: "#333", fontSize: 13 },
  closeBtn: { position: "absolute", right: 20, top: 12, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#333", fontSize: 16 },

  scroll: { padding: 16, paddingBottom: 8 },

  // ── Card ──
  card: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    backgroundColor: "#0a0a0a",
    marginBottom: 16,
  },

  cardHero: { height: CARD_HEIGHT * 0.6, position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  heroGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 160 },
  heroInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20 },
  heroNameRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 4 },
  heroName: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  heroAge: { color: "rgba(255,255,255,0.7)", fontSize: 22, fontWeight: "300" },
  heroBio: { color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 20 },

  cardBody: { padding: 16 },

  photoStrip: { marginBottom: 16 },
  extraPhoto: { width: 80, height: 80, borderRadius: 10 },

  chips: { gap: 10, marginBottom: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#111", borderWidth: 1, borderColor: "#1a1a1a", borderRadius: 10, padding: 12 },
  chipIcon: { fontSize: 18 },
  chipLabel: { color: "#333", fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  chipValue: { color: "#fff", fontSize: 14, fontWeight: "600" },

  tagsSection: { marginTop: 4 },
  tagsLabel: { color: "#333", fontSize: 9, letterSpacing: 2, marginBottom: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { borderWidth: 1, borderColor: "#FF3C50", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,60,80,0.06)" },
  tagText: { color: "#FF3C50", fontSize: 12 },

  // ── Strength ──
  strengthCard: { backgroundColor: "#0a0a0a", borderWidth: 1, borderColor: "#111", borderRadius: 14, padding: 16, marginBottom: 8 },
  strengthLabel: { color: "#333", fontSize: 9, letterSpacing: 2, marginBottom: 12 },
  strengthBar: { height: 6, backgroundColor: "#1a1a1a", borderRadius: 3, marginBottom: 8, overflow: "hidden" },
  strengthFill: { height: 6, backgroundColor: "#FF3C50", borderRadius: 3 },
  strengthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  strengthPct: { color: "#FF3C50", fontSize: 16, fontWeight: "800" },
  strengthTip: { color: "#333", fontSize: 12, flex: 1, textAlign: "right" },

  doneBtn: { margin: 16, marginTop: 8, borderRadius: 10, overflow: "hidden" },
  doneBtnGradient: { paddingVertical: 16, alignItems: "center" },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 },
});
