import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Animated, PanResponder,
  Dimensions, TouchableOpacity, ActivityIndicator,
  Alert, StatusBar, Image, ScrollView, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { api } from "../api";
import { useUser } from "../context/UserContext";
import Avatar from "../components/Avatar";

const { width, height } = Dimensions.get("window");
const SWIPE_THRESHOLD = width * 0.35;

function FullProfileSheet({ person, visible, onClose, onPropose }) {
  const slideAnim = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible]);

  const allPhotos = [
    ...(person.avatar_url ? [person.avatar_url] : []),
    ...(person.photo_urls || []),
  ].filter(Boolean);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={fp.overlay}>
        <TouchableOpacity style={fp.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[fp.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={fp.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={fp.scroll}>
            {allPhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={fp.photoRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
                {allPhotos.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={[fp.gridPhoto, i === 0 && fp.gridPhotoFirst]} resizeMode="cover" />
                ))}
              </ScrollView>
            ) : (
              <View style={fp.noPhoto}><Avatar uri={null} name={person.display_name} size={100} /></View>
            )}
            <View style={fp.body}>
              <View style={fp.nameRow}>
                <Text style={fp.name}>{person.display_name}</Text>
                {person.age && <Text style={fp.age}>{person.age}</Text>}
                <View style={fp.distPill}><Text style={fp.distText}>{person.distance_miles} mi</Text></View>
              </View>
              {person.bio ? <Text style={fp.bio}>{person.bio}</Text> : <Text style={fp.bioEmpty}>No bio yet</Text>}
              <View style={fp.chips}>
                {person.looking_for && (
                  <View style={fp.chip}>
                    <Text style={fp.chipIcon}>🔥</Text>
                    <View><Text style={fp.chipLabel}>LOOKING FOR</Text><Text style={fp.chipValue}>{person.looking_for}</Text></View>
                  </View>
                )}
                {person.sexuality && (
                  <View style={fp.chip}>
                    <Text style={fp.chipIcon}>✦</Text>
                    <View><Text style={fp.chipLabel}>SEXUALITY</Text><Text style={fp.chipValue}>{person.sexuality}</Text></View>
                  </View>
                )}
              </View>
              {person.shared_tags?.length > 0 && (
                <View style={fp.tagSection}>
                  <Text style={fp.tagSectionLabel}>IN COMMON</Text>
                  <View style={fp.tags}>
                    {person.shared_tags.map((t) => <View key={t} style={fp.tag}><Text style={fp.tagText}>{t}</Text></View>)}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
          <View style={fp.actions}>
            <TouchableOpacity style={fp.passBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={fp.passBtnText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fp.proposeBtn} onPress={() => { onClose(); onPropose(person); }} activeOpacity={0.85}>
              <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fp.proposeBtnGrad}>
                <Text style={fp.proposeBtnText}>Send Proposal 🔥</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const fp = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.8)" },
  sheet: { backgroundColor: "#080808", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: "#1a1a1a", maxHeight: height * 0.92 },
  handle: { width: 36, height: 4, backgroundColor: "#1e1e1e", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 },
  scroll: { paddingBottom: 16 },
  photoRow: { marginBottom: 4 },
  gridPhoto: { width: 140, height: 190, borderRadius: 14 },
  gridPhotoFirst: { width: 200, height: 260 },
  noPhoto: { height: 200, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  name: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  age: { color: "#555", fontSize: 20 },
  distPill: { backgroundColor: "#111", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#1a1a1a", marginLeft: "auto" },
  distText: { color: "#444", fontSize: 12 },
  bio: { color: "#888", fontSize: 15, lineHeight: 22, marginBottom: 20 },
  bioEmpty: { color: "#222", fontSize: 14, fontStyle: "italic", marginBottom: 20 },
  chips: { gap: 10, marginBottom: 20 },
  chip: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0e0e0e", borderWidth: 1, borderColor: "#1a1a1a", borderRadius: 10, padding: 12 },
  chipIcon: { fontSize: 18 },
  chipLabel: { color: "#333", fontSize: 9, letterSpacing: 2, marginBottom: 2 },
  chipValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  tagSection: {},
  tagSectionLabel: { color: "#333", fontSize: 9, letterSpacing: 2, marginBottom: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { borderWidth: 1, borderColor: "#FF3C50", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,60,80,0.08)" },
  tagText: { color: "#FF3C50", fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 12, padding: 16, paddingBottom: 32, borderTopWidth: 1, borderColor: "#0e0e0e" },
  passBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#111", borderWidth: 1, borderColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  passBtnText: { color: "#444", fontSize: 18 },
  proposeBtn: { flex: 1, borderRadius: 12, overflow: "hidden" },
  proposeBtnGrad: { paddingVertical: 18, alignItems: "center" },
  proposeBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
});

function UserCard({ person, onPropose, onViewProfile }) {
  const allPhotos = [...(person.avatar_url ? [person.avatar_url] : []), ...(person.photo_urls || [])].filter(Boolean);
  const [photoIndex, setPhotoIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const totalPhotos = allPhotos.length;
  const currentPhoto = allPhotos[photoIndex] || null;

  const goTo = (idx) => {
    if (idx < 0 || idx >= totalPhotos) return;
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setPhotoIndex(idx);
  };

  const handleTap = (e) => {
    const tapX = e.nativeEvent.locationX;
    if (tapX < width * 0.35) goTo(photoIndex - 1);
    else if (tapX > width * 0.65) goTo(photoIndex + 1);
    else onViewProfile();
  };

  return (
    <View style={card.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {currentPhoto
          ? <Image source={{ uri: currentPhoto }} style={card.photo} resizeMode="cover" />
          : <View style={card.photoPlaceholder}><Avatar uri={null} name={person.display_name} size={120} /></View>
        }
      </Animated.View>
      {totalPhotos > 1 && (
        <View style={card.dots}>
          {allPhotos.map((_, i) => <View key={i} style={[card.dot, i === photoIndex && card.dotActive]} />)}
        </View>
      )}
      <TouchableOpacity style={card.tapZone} onPress={handleTap} activeOpacity={1} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.97)"]} style={card.gradient} pointerEvents="none" />
      <View style={card.distBadge} pointerEvents="none"><Text style={card.distText}>{person.distance_miles} mi</Text></View>
      {totalPhotos > 1 && <View style={card.photoCtr} pointerEvents="none"><Text style={card.photoCtrText}>{photoIndex + 1}/{totalPhotos}</Text></View>}
      <View style={card.info} pointerEvents="none">
        <View style={card.nameRow}>
          <Text style={card.name}>{person.display_name}</Text>
          {person.age && <Text style={card.age}>{person.age}</Text>}
        </View>
        {person.looking_for && <Text style={card.lookingFor}>🔥 {person.looking_for}</Text>}
        {person.bio ? <Text style={card.bio} numberOfLines={2}>{person.bio}</Text> : null}
        {person.shared_tags?.length > 0 && (
          <View style={card.tags}>
            {person.shared_tags.slice(0, 4).map((t) => <View key={t} style={card.tag}><Text style={card.tagText}>{t}</Text></View>)}
          </View>
        )}
        <TouchableOpacity style={card.viewProfileHint} onPress={onViewProfile} activeOpacity={0.7}>
          <Text style={card.viewProfileHintText}>tap center to view full profile →</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={card.proposeBtn} onPress={() => onPropose(person)} activeOpacity={0.85}>
        <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={card.proposeBtnGrad}>
          <Text style={card.proposeBtnText}>Send Proposal</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const card = StyleSheet.create({
  root: { width: "100%", height: "100%", borderRadius: 20, overflow: "hidden", backgroundColor: "#0a0a0a" },
  photo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  photoPlaceholder: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  dots: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", gap: 4, zIndex: 10 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  dotActive: { backgroundColor: "#fff" },
  tapZone: { position: "absolute", top: 0, left: 0, right: 0, bottom: 120, zIndex: 5 },
  gradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: "65%", zIndex: 6 },
  distBadge: { position: "absolute", top: 36, right: 16, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", zIndex: 10 },
  distText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  photoCtr: { position: "absolute", top: 36, left: 16, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, zIndex: 10 },
  photoCtrText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  info: { position: "absolute", bottom: 72, left: 0, right: 0, padding: 20, zIndex: 7 },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 4 },
  name: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  age: { color: "rgba(255,255,255,0.7)", fontSize: 20, fontWeight: "300" },
  lookingFor: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginBottom: 6 },
  bio: { color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 18, marginBottom: 10 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tag: { borderWidth: 1, borderColor: "rgba(255,60,80,0.6)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(255,60,80,0.15)" },
  tagText: { color: "#FF3C50", fontSize: 11, fontWeight: "600" },
  viewProfileHint: { alignSelf: "flex-start", paddingVertical: 4 },
  viewProfileHintText: { color: "rgba(255,255,255,0.25)", fontSize: 11, letterSpacing: 0.3 },
  proposeBtn: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 8, margin: 16, borderRadius: 12, overflow: "hidden" },
  proposeBtnGrad: { paddingVertical: 16, alignItems: "center" },
  proposeBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 },
});

function SwipeCard({ person, onSwipeLeft, onSwipeRight, onPropose, isTop, index }) {
  const position = useRef(new Animated.ValueXY()).current;
  const [showProfile, setShowProfile] = useState(false);
  const rotate = position.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: ["-12deg", "0deg", "12deg"], extrapolate: "clamp" });
  const likeOpacity = position.x.interpolate({ inputRange: [0, width * 0.25], outputRange: [0, 1], extrapolate: "clamp" });
  const nopeOpacity = position.x.interpolate({ inputRange: [-width * 0.25, 0], outputRange: [1, 0], extrapolate: "clamp" });

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => isTop && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 5,
    onPanResponderGrant: () => { position.setOffset({ x: position.x._value, y: position.y._value }); position.setValue({ x: 0, y: 0 }); },
    onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      position.flattenOffset();
      if (g.dx > SWIPE_THRESHOLD) swipeOut("right");
      else if (g.dx < -SWIPE_THRESHOLD) swipeOut("left");
      else Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }).start();
    },
  })).current;

  const swipeOut = (dir) => {
    const x = dir === "right" ? width * 1.5 : -width * 1.5;
    Animated.timing(position, { toValue: { x, y: 0 }, duration: 280, useNativeDriver: false }).start(() => {
      dir === "right" ? onSwipeRight(person) : onSwipeLeft(person);
    });
  };

  const scale = index === 0 ? 1 : index === 1 ? 0.96 : 0.92;
  const ty    = index === 0 ? 0 : index === 1 ? 12 : 24;

  if (!isTop) {
    return (
      <Animated.View pointerEvents="none" style={[sw.card, { transform: [{ scale }, { translateY: ty }], zIndex: 10 - index }]}>
        <UserCard person={person} onPropose={onPropose} onViewProfile={() => {}} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[sw.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }], zIndex: 20 }]} {...panResponder.panHandlers}>
      <Animated.View style={[sw.stamp, sw.likeStamp, { opacity: likeOpacity }]}><Text style={sw.likeText}>DOWN</Text></Animated.View>
      <Animated.View style={[sw.stamp, sw.nopeStamp, { opacity: nopeOpacity }]}><Text style={sw.nopeText}>PASS</Text></Animated.View>
      <UserCard person={person} onPropose={onPropose} onViewProfile={() => setShowProfile(true)} />
      <FullProfileSheet person={person} visible={showProfile} onClose={() => setShowProfile(false)} onPropose={onPropose} />
    </Animated.View>
  );
}

const sw = StyleSheet.create({
  card: { position: "absolute", width: width - 32, height: height * 0.72, top: 0 },
  stamp: { position: "absolute", top: 36, zIndex: 99, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, borderWidth: 2 },
  likeStamp: { left: 20, borderColor: "#FF3C50", backgroundColor: "rgba(255,60,80,0.1)", transform: [{ rotate: "-15deg" }] },
  nopeStamp: { right: 20, borderColor: "#333", backgroundColor: "rgba(0,0,0,0.4)", transform: [{ rotate: "15deg" }] },
  likeText: { color: "#FF3C50", fontWeight: "900", fontSize: 22, letterSpacing: 3 },
  nopeText: { color: "#444", fontWeight: "900", fontSize: 22, letterSpacing: 3 },
});

function DownTonightPaywall({ visible, onClose, onPurchase }) {
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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={pay.overlay}>
        <TouchableOpacity style={pay.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[pay.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={pay.handle} />
          <View style={pay.iconWrap}>
            <Animated.View style={[pay.iconRing,  { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[pay.iconRing2, { transform: [{ scale: pulseAnim }], opacity: 0.25 }]} />
            <Text style={pay.iconEmoji}>🔥</Text>
          </View>
          <Text style={pay.title}>Down Tonight</Text>
          <Text style={pay.subtitle}>Your profile jumps to the top of everyone nearby with a live pulse ring. They know you're available <Text style={pay.subtitleBold}>right now.</Text></Text>
          {[
            { icon: "⚡", text: "Pinned to top of nearby for 2 hours" },
            { icon: "💫", text: "Animated pulse ring around your card" },
            { icon: "🔴", text: "Live \"Down Tonight\" badge on your profile" },
            { icon: "⏱️", text: "Auto-expires — no recurring charge" },
          ].map((p, i) => (
            <View key={i} style={pay.perk}>
              <Text style={pay.perkIcon}>{p.icon}</Text>
              <Text style={pay.perkText}>{p.text}</Text>
            </View>
          ))}
          <TouchableOpacity style={pay.buyBtn} onPress={onPurchase} activeOpacity={0.85}>
            <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={pay.buyBtnGrad}>
              <Text style={pay.buyBtnPrice}>$1.99</Text>
              <Text style={pay.buyBtnLabel}>Activate for 2 hours</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={pay.disclaimer}>One-time charge · Expires automatically · Not a subscription</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const pay = StyleSheet.create({
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

function useDownTimer(expiresAt) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!expiresAt) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const mins  = Math.floor(remaining / 60000);
  const secs  = Math.floor((remaining % 60000) / 1000);
  const label = remaining > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : null;
  const pct   = expiresAt ? remaining / (2 * 60 * 60 * 1000) : 0;
  return { label, active: remaining > 0, pct: Math.min(1, pct) };
}

export default function NearbyScreen({ onSendProposal }) {
  const { token }                           = useUser();
  const [people, setPeople]                 = useState([]);
  const [loading, setLoading]               = useState(true);
  const [showPaywall, setShowPaywall]       = useState(false);
  const [downExpiresAt, setDownExpiresAt]   = useState(null);

  const { label: timerLabel, active: isDown, pct: timerPct } = useDownTimer(downExpiresAt);
  const ringAnim  = useRef(new Animated.Value(1)).current;
  const ringAnim2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isDown) {
      Animated.loop(Animated.sequence([
        Animated.timing(ringAnim,  { toValue: 1.3, duration: 900,  useNativeDriver: true }),
        Animated.timing(ringAnim,  { toValue: 1,   duration: 900,  useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(ringAnim2, { toValue: 1.6, duration: 1400, useNativeDriver: true }),
        Animated.timing(ringAnim2, { toValue: 1,   duration: 1400, useNativeDriver: true }),
      ])).start();
    } else {
      ringAnim.stopAnimation();  ringAnim.setValue(1);
      ringAnim2.stopAnimation(); ringAnim2.setValue(1);
    }
  }, [isDown]);

  const fetchNearby = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Location required", "Enable location to see who's nearby."); setLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({});
      await api.updateLocation(token, loc.coords.latitude, loc.coords.longitude);
      const [results, sent] = await Promise.all([
        api.getNearby(token, loc.coords.latitude, loc.coords.longitude),
        api.getSent(token),
      ]);
      const sentIds = new Set((Array.isArray(sent) ? sent : []).map((p) => p.receiver_id));
      setPeople((Array.isArray(results) ? results : []).filter((p) => !sentIds.has(p.id)));
    } catch {
      Alert.alert("Error", "Could not fetch nearby users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNearby(); }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>PULSE</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={[s.downBtn, isDown && s.downBtnActive]} onPress={() => !isDown && setShowPaywall(true)} activeOpacity={isDown ? 1 : 0.8}>
            {isDown && <>
              <Animated.View style={[s.downRing,  { transform: [{ scale: ringAnim  }] }]} />
              <Animated.View style={[s.downRing2, { transform: [{ scale: ringAnim2 }] }]} />
            </>}
            <Text style={s.downBtnEmoji}>🔥</Text>
            <Text style={[s.downBtnLabel, isDown && s.downBtnLabelActive]}>{isDown ? timerLabel : "Down?"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.refreshBtn} onPress={fetchNearby}>
            <Text style={s.refreshText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isDown && (
        <View style={s.timerWrap}>
          <View style={s.timerBg}><View style={[s.timerFill, { width: `${timerPct * 100}%` }]} /></View>
          <Text style={s.timerLabel}>🔴 Boost active · {timerLabel} remaining</Text>
        </View>
      )}

      <View style={s.cardArea}>
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color="#FF3C50" size="large" />
            <Text style={s.loadingText}>Finding people nearby...</Text>
          </View>
        ) : people.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyTitle}>No one nearby</Text>
            <Text style={s.emptySub}>Check back soon or update your tags</Text>
            <TouchableOpacity style={s.retryBtn} onPress={fetchNearby}><Text style={s.retryText}>Refresh</Text></TouchableOpacity>
          </View>
        ) : (
          <SwipeCard
            key={people[0].id}
            person={people[0]}
            index={0}
            isTop={true}
            onSwipeLeft={() => setPeople((p) => p.slice(1))}
            onSwipeRight={(person) => onSendProposal(person)}
            onPropose={(p) => onSendProposal(p)}
          />
        )}
      </View>

      {people.length > 0 && !loading && (
        <View style={s.hint}><Text style={s.hintText}>← pass · tap center for profile · propose →</Text></View>
      )}

      <DownTonightPaywall visible={showPaywall} onClose={() => setShowPaywall(false)} onPurchase={() => { setShowPaywall(false); setDownExpiresAt(Date.now() + 2 * 60 * 60 * 1000); Alert.alert("🔥 You're Down Tonight!", "Your profile is boosted for 2 hours."); }} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808", paddingTop: 60 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 10 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  downBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0e0e0e", borderWidth: 1, borderColor: "#1e1e1e", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, position: "relative", overflow: "visible" },
  downBtnActive: { borderColor: "#FF3C50", backgroundColor: "rgba(255,60,80,0.08)" },
  downRing: { position: "absolute", top: -6, left: -6, right: -6, bottom: -6, borderRadius: 26, borderWidth: 1.5, borderColor: "#FF3C50", opacity: 0.45 },
  downRing2: { position: "absolute", top: -14, left: -14, right: -14, bottom: -14, borderRadius: 34, borderWidth: 1, borderColor: "#FF3C50", opacity: 0.15 },
  downBtnEmoji: { fontSize: 14 },
  downBtnLabel: { color: "#333", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, minWidth: 38, textAlign: "center" },
  downBtnLabelActive: { color: "#FF3C50" },
  timerWrap: { paddingHorizontal: 20, marginBottom: 10 },
  timerBg: { height: 2, backgroundColor: "#161616", borderRadius: 1, marginBottom: 6, overflow: "hidden" },
  timerFill: { height: 2, backgroundColor: "#FF3C50", borderRadius: 1 },
  timerLabel: { color: "#FF3C50", fontSize: 10, opacity: 0.65, letterSpacing: 0.5 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#111", borderWidth: 1, borderColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#FF3C50", fontSize: 18 },
  cardArea: { flex: 1, alignItems: "center", paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#333", fontSize: 13, letterSpacing: 0.5, marginTop: 12 },
  emptyTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },
  emptySub: { color: "#333", fontSize: 14, textAlign: "center" },
  retryBtn: { marginTop: 8, borderWidth: 1, borderColor: "#FF3C50", borderRadius: 4, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#FF3C50", fontSize: 14 },
  hint: { alignItems: "center", paddingBottom: 20 },
  hintText: { color: "#1a1a1a", fontSize: 11, letterSpacing: 0.5 },
});
