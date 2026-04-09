import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Animated, ActivityIndicator, TextInput,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "../context/UserContext";
import Avatar from "../components/Avatar";
import ProfilePreviewModal from "../components/ProfilePreviewModal";
import { pickAndUploadPhoto } from "../utils/uploadPhoto";
import { api } from "../api";

const MAX_PHOTOS = 6;

const ALL_TAGS = [
  "late nights", "drinks", "gym", "spontaneous",
  "coffee", "dancing", "travel", "art",
  "music", "food", "hiking", "gaming",
];

const LOOKING_FOR_OPTIONS = [
  "Casual hookup",
  "Friends with benefits",
  "Threesome / group",
  "Casual dating",
  "No strings attached",
  "Open to anything",
];

const SEXUALITY_OPTIONS = [
  "Straight", "Gay", "Lesbian", "Bisexual",
  "Pansexual", "Queer", "Prefer not to say",
];

function PickerModal({ visible, title, options, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pm.overlay} onPress={onClose} activeOpacity={1} />
      <View style={pm.sheet}>
        <View style={pm.handle} />
        <Text style={pm.title}>{title}</Text>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[pm.option, selected === opt && pm.optionActive]}
            onPress={() => { onSelect(opt); onClose(); }}
          >
            <Text style={[pm.optionText, selected === opt && pm.optionTextActive]}>{opt}</Text>
            {selected === opt && <Text style={pm.check}>✓</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={pm.cancelBtn} onPress={onClose}>
          <Text style={pm.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: "#0e0e0e", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: "#1c1c1c", padding: 20, paddingBottom: 40 },
  handle: { width: 36, height: 4, backgroundColor: "#222", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  title: { color: "#555", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 },
  option: { paddingVertical: 16, borderBottomWidth: 1, borderColor: "#141414", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  optionActive: { borderColor: "#141414" },
  optionText: { color: "#666", fontSize: 16 },
  optionTextActive: { color: "#fff", fontWeight: "600" },
  check: { color: "#FF3C50", fontSize: 16, fontWeight: "700" },
  cancelBtn: { marginTop: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#1a1a1a", borderRadius: 6 },
  cancelText: { color: "#444", fontSize: 15 },
});

export default function ProfileScreen() {
  const { user, token, setUser, logout } = useUser();

  const [photos, setPhotos]           = useState(user.photo_urls || []);
  const [bio, setBio]                 = useState(user.bio || "");
  const [age, setAge]                 = useState(user.age ? String(user.age) : "");
  const [lookingFor, setLookingFor]   = useState(user.looking_for || "");
  const [sexuality, setSexuality]     = useState(user.sexuality || "");
  const [tags, setTags]               = useState(user.interest_tags || []);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showLookingFor, setShowLookingFor] = useState(false);
  const [showSexuality, setShowSexuality]   = useState(false);
  const [activatingDownTonight, setActivatingDownTonight] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleAddPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Max photos", `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setUploading(true);
    try {
      const url = await pickAndUploadPhoto(`${user.id}-${Date.now()}`);
      if (!url) return;
      const newPhotos = [...photos, url];
      setPhotos(newPhotos);
      const updates = { photo_urls: newPhotos };
      if (!user.avatar_url) updates.avatar_url = url;
      await saveToBackend(updates);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (index) => {
    Alert.alert("Remove photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          const newPhotos = photos.filter((_, i) => i !== index);
          setPhotos(newPhotos);
          await saveToBackend({ photo_urls: newPhotos });
        },
      },
    ]);
  };

  const saveToBackend = async (updates) => {
    try {
      const updated = await api.updateProfile(token, updates);
      if (updated.id) setUser({ ...user, ...updates }, token);
    } catch {
      Alert.alert("Error", "Could not save.");
    }
  };

  const handleActivateDownTonight = async () => {
    Alert.alert(
      "DOWN TONIGHT",
      "Activate for 8 hours? You'll be visible to nearby users looking for action right now.\n\n$1.99",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Activate ($1.99)",
          onPress: async () => {
            setActivatingDownTonight(true);
            try {
              // TODO: RevenueCat payment flow will go here
              // For now, just activate directly (free during development)
              const result = await api.activateDownTonight(token);
              if (result.message) {
                Alert.alert("🔥 DOWN TONIGHT", "You're now visible as DOWN TONIGHT for 8 hours!");
                // Refresh user data
                const updatedUser = await api.getMe(token);
                setUser(updatedUser, token);
              }
            } catch (err) {
              Alert.alert("Error", err.message || "Could not activate");
            } finally {
              setActivatingDownTonight(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveAll = async () => {
    if (tags.length === 0) { Alert.alert("Pick at least one tag"); return; }
    setSaving(true);
    try {
      const updates = {
        bio: bio.trim(),
        age: age ? parseInt(age) : null,
        looking_for: lookingFor || null,
        sexuality: sexuality || null,
        interest_tags: tags,
      };
      const updated = await api.updateProfile(token, updates);
      if (updated.id) {
        setUser({ ...user, ...updates }, token);
        Alert.alert("Saved ✓");
      }
    } catch {
      Alert.alert("Error", "Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log out", "You'll need to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);
  };

  const toggleTag = (tag) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  // Check if DOWN TONIGHT is active
  const downTonightActive = user.down_tonight_until && new Date(user.down_tonight_until) > new Date();

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <View style={s.accentLine} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={{ height: 20 }} />

          <View style={s.nameBlock}>
            <Text style={s.label}>PROFILE</Text>
            <Text style={s.displayName}>{user.display_name}</Text>
            <Text style={s.username}>@{user.username}</Text>
          </View>

          <Text style={s.sectionLabel}>PHOTOS</Text>
          <View style={s.photoGrid}>
            {photos.map((uri, index) => (
              <TouchableOpacity key={uri} style={s.photoSlot} onLongPress={() => handleRemovePhoto(index)}>
                <Avatar uri={uri} name={user.display_name} size={100} />
                {index === 0 && (
                  <View style={s.mainBadge}><Text style={s.mainBadgeText}>MAIN</Text></View>
                )}
              </TouchableOpacity>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity style={s.addPhotoSlot} onPress={handleAddPhoto} disabled={uploading}>
                {uploading
                  ? <ActivityIndicator color="#FF3C50" />
                  : <Text style={s.addPhotoIcon}>+</Text>
                }
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.photoHint}>Hold to remove · {photos.length}/{MAX_PHOTOS} photos</Text>

          {/* DOWN TONIGHT SECTION - NEW */}
          <Text style={s.sectionLabel}>DOWN TONIGHT</Text>
          <TouchableOpacity 
            style={[s.downTonightCard, downTonightActive && s.downTonightCardActive]} 
            onPress={handleActivateDownTonight}
            disabled={activatingDownTonight || downTonightActive}
            activeOpacity={0.8}
          >
            {downTonightActive ? (
              <>
                <View style={s.downTonightBadge}>
                  <Text style={s.downTonightBadgeText}>🔥 ACTIVE</Text>
                </View>
                <Text style={s.downTonightTitle}>You're DOWN TONIGHT</Text>
                <Text style={s.downTonightSubtitle}>
                  Expires {new Date(user.down_tonight_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </>
            ) : (
              <>
                <Text style={s.downTonightTitle}>🔥 Activate DOWN TONIGHT</Text>
                <Text style={s.downTonightSubtitle}>
                  Show nearby users you're available right now · 8 hours · $1.99
                </Text>
                {activatingDownTonight && <ActivityIndicator color="#FF3C50" style={{ marginTop: 8 }} />}
              </>
            )}
          </TouchableOpacity>

          <Text style={s.sectionLabel}>BIO</Text>
          <View style={s.inputWrap}>
            <TextInput
              style={s.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Say something about yourself..."
              placeholderTextColor="#2a2a2a"
              multiline
              maxLength={150}
              selectionColor="#FF3C50"
            />
            <Text style={s.charCount}>{bio.length}/150</Text>
          </View>

          <Text style={s.sectionLabel}>AGE</Text>
          <View style={[s.inputWrap, { marginBottom: 24 }]}>
            <TextInput
              style={s.ageInput}
              value={age}
              onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ""))}
              placeholder="Your age"
              placeholderTextColor="#2a2a2a"
              keyboardType="numeric"
              maxLength={3}
              selectionColor="#FF3C50"
            />
          </View>

          <Text style={s.sectionLabel}>LOOKING FOR</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setShowLookingFor(true)}>
            <Text style={[s.pickerBtnText, lookingFor && s.pickerBtnSelected]}>{lookingFor || "Select..."}</Text>
            <Text style={s.pickerArrow}>›</Text>
          </TouchableOpacity>

          <Text style={s.sectionLabel}>SEXUALITY</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setShowSexuality(true)}>
            <Text style={[s.pickerBtnText, sexuality && s.pickerBtnSelected]}>{sexuality || "Select..."}</Text>
            <Text style={s.pickerArrow}>›</Text>
          </TouchableOpacity>

          <Text style={s.sectionLabel}>I'M DOWN FOR</Text>
          <View style={s.tags}>
            {ALL_TAGS.map((tag) => {
              const active = tags.includes(tag);
              return (
                <TouchableOpacity key={tag} onPress={() => toggleTag(tag)} activeOpacity={0.7} style={[s.tag, active && s.tagActive]}>
                  {active && <View style={s.tagDot} />}
                  <Text style={[s.tagText, active && s.tagTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={s.saveBtn} onPress={handleSaveAll} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={["#FF3C50", "#C0183B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveBtnGradient}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Profile</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.previewBtn} onPress={() => setShowPreview(true)} activeOpacity={0.7}>
            <Text style={s.previewBtnText}>Preview my profile →</Text>
          </TouchableOpacity>

          <View style={s.bottomSection}>
            <View style={s.idRow}>
              <Text style={s.idLabel}>USER ID</Text>
              <Text style={s.idValue}>{user.id?.slice(0, 8).toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Text style={s.logoutText}>Sign out</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      <PickerModal visible={showLookingFor} title="Looking for" options={LOOKING_FOR_OPTIONS} selected={lookingFor} onSelect={setLookingFor} onClose={() => setShowLookingFor(false)} />
      <PickerModal visible={showSexuality} title="Sexuality" options={SEXUALITY_OPTIONS} selected={sexuality} onSelect={setSexuality} onClose={() => setShowSexuality(false)} />
      <ProfilePreviewModal
        visible={showPreview}
        user={{ ...user, bio, age: age ? parseInt(age) : null, looking_for: lookingFor, sexuality, interest_tags: tags, photo_urls: photos }}
        onClose={() => setShowPreview(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#060606" },
  accentLine: { position: "absolute", left: 24, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,60,80,0.12)" },
  scroll: { paddingLeft: 40, paddingRight: 24, paddingBottom: 80 },
  nameBlock: { marginBottom: 32 },
  label: { fontSize: 9, letterSpacing: 3, color: "#FF3C50", marginBottom: 12 },
  displayName: { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -1, lineHeight: 40, marginBottom: 4 },
  username: { fontSize: 13, color: "#2a2a2a", letterSpacing: 1 },
  sectionLabel: { fontSize: 9, letterSpacing: 3, color: "#2a2a2a", marginBottom: 12, marginTop: 8 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  photoSlot: { position: "relative" },
  mainBadge: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(255,60,80,0.85)", paddingVertical: 3, alignItems: "center", borderBottomLeftRadius: 50, borderBottomRightRadius: 50 },
  mainBadgeText: { color: "#fff", fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  addPhotoSlot: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, borderColor: "#1e1e1e", borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" },
  addPhotoIcon: { color: "#FF3C50", fontSize: 28, fontWeight: "300" },
  photoHint: { color: "#1e1e1e", fontSize: 11, marginBottom: 28 },
  
  // DOWN TONIGHT STYLES - NEW
  downTonightCard: { 
    backgroundColor: "#0e0e0e", 
    borderWidth: 1, 
    borderColor: "#1a1a1a", 
    borderRadius: 8, 
    padding: 20, 
    marginBottom: 32,
    position: "relative",
  },
  downTonightCardActive: { 
    borderColor: "rgba(255,60,80,0.4)", 
    backgroundColor: "rgba(255,60,80,0.05)" 
  },
  downTonightBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FF3C50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  downTonightBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  downTonightTitle: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "700", 
    marginBottom: 6 
  },
  downTonightSubtitle: { 
    color: "#555", 
    fontSize: 13, 
    lineHeight: 18 
  },
  
  inputWrap: { backgroundColor: "#0e0e0e", borderWidth: 1, borderColor: "#1a1a1a", borderRadius: 6, padding: 14, marginBottom: 24 },
  bioInput: { color: "#fff", fontSize: 15, lineHeight: 22, minHeight: 80, textAlignVertical: "top" },
  ageInput: { color: "#fff", fontSize: 15 },
  charCount: { color: "#222", fontSize: 11, textAlign: "right", marginTop: 6 },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0e0e0e", borderWidth: 1, borderColor: "#1a1a1a", borderRadius: 6, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 24 },
  pickerBtnText: { color: "#2a2a2a", fontSize: 15 },
  pickerBtnSelected: { color: "#fff" },
  pickerArrow: { color: "#333", fontSize: 20 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 32 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#111", borderRadius: 2, backgroundColor: "#080808" },
  tagActive: { borderColor: "rgba(255,60,80,0.3)", backgroundColor: "rgba(255,60,80,0.05)" },
  tagDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#FF3C50" },
  tagText: { color: "#222", fontSize: 13, fontWeight: "500" },
  tagTextActive: { color: "#fff" },
  saveBtn: { borderRadius: 6, overflow: "hidden", marginBottom: 12 },
  saveBtnGradient: { paddingVertical: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  previewBtn: { alignItems: "center", paddingVertical: 14, marginBottom: 32 },
  previewBtnText: { color: "#FF3C50", fontSize: 14, letterSpacing: 0.5 },
  bottomSection: { borderTopWidth: 1, borderColor: "#0e0e0e", paddingTop: 24, gap: 20 },
  idRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  idLabel: { color: "#1a1a1a", fontSize: 9, letterSpacing: 3 },
  idValue: { color: "#1a1a1a", fontSize: 11, letterSpacing: 2, fontWeight: "600" },
  logoutBtn: { paddingVertical: 14, borderWidth: 1, borderColor: "#111", borderRadius: 4, alignItems: "center" },
  logoutText: { color: "#333", fontSize: 14, letterSpacing: 1 },
});
