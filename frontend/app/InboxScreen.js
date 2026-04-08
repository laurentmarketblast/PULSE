import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Image,
} from "react-native";
import { api } from "../api";
import { useUser } from "../context/UserContext";
import ChatScreen from "./ChatScreen";

const STATUS_COLOR = {
  pending:  "#FF9500",
  accepted: "#30D158",
  declined: "#333",
  expired:  "#222",
};

const STATUS_LABEL = {
  pending:  "PENDING",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  expired:  "EXPIRED",
};

function Avatar({ photo, name, size = 48 }) {
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: "#1a1a1a" }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#FF3C50", alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: "#1a1a1a",
    }}>
      <Text style={{ color: "#fff", fontSize: size * 0.4, fontWeight: "bold" }}>
        {name ? name.charAt(0).toUpperCase() : "?"}
      </Text>
    </View>
  );
}

function ProposalCard({ item, mode, onRespond, onOpenChat, onViewProfile }) {
  const isPending   = item.status === "pending" && mode === "received";
  const isAccepted  = item.status === "accepted";
  const statusColor = STATUS_COLOR[item.status] || "#333";

  const otherUser   = mode === "sent" ? item._receiver : item._sender;
  const photo       = otherUser?.avatar_url || null;
  const name        = otherUser?.display_name || "Unknown";
  const userId      = mode === "sent" ? item.receiver_id : item.sender_id;

  return (
    <View style={card.root}>
      <View style={[card.accent, { backgroundColor: isPending ? "#FF3C50" : isAccepted ? "#30D158" : "#1a1a1a" }]} />
      <View style={card.body}>
        <View style={card.topRow}>
          <TouchableOpacity onPress={() => onViewProfile(otherUser)} activeOpacity={0.7}>
            <Avatar photo={photo} name={name} size={50} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => onViewProfile(otherUser)} activeOpacity={0.7}>
              <Text style={card.name}>{name}</Text>
            </TouchableOpacity>
            <Text style={card.label}>{mode === "sent" ? "You proposed" : "Incoming proposal"}</Text>
            {item.message
              ? <Text style={card.message}>"{item.message}"</Text>
              : <Text style={card.tag}>{item.activity_tag}</Text>
            }
          </View>

          <View style={[card.statusBadge, { borderColor: statusColor }]}>
            <Text style={[card.statusText, { color: statusColor }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        {isAccepted && (
          <TouchableOpacity style={card.chatBtn} onPress={() => onOpenChat(item, otherUser)}>
            <Text style={card.chatBtnText}>Open Chat →</Text>
          </TouchableOpacity>
        )}

        {isPending && (
          <View style={card.actions}>
            <TouchableOpacity style={card.acceptBtn} onPress={() => onRespond(item.id, true)}>
              <Text style={card.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={card.declineBtn} onPress={() => onRespond(item.id, false)}>
              <Text style={card.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  root: { flexDirection: "row", backgroundColor: "#0e0e0e", borderRadius: 12, marginBottom: 10, overflow: "hidden", borderWidth: 1, borderColor: "#1a1a1a" },
  accent: { width: 3 },
  body: { flex: 1, padding: 16 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  name: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 2 },
  label: { color: "#444", fontSize: 11, letterSpacing: 0.5, marginBottom: 4 },
  message: { color: "#ccc", fontSize: 14, fontStyle: "italic", lineHeight: 20 },
  tag: { color: "#fff", fontSize: 14, fontWeight: "600" },
  statusBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  statusText: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  chatBtn: { borderWidth: 1, borderColor: "#30D158", borderRadius: 6, paddingVertical: 10, alignItems: "center", backgroundColor: "rgba(48,209,88,0.06)", marginBottom: 4 },
  chatBtnText: { color: "#30D158", fontWeight: "700", fontSize: 13, letterSpacing: 0.5 },
  actions: { flexDirection: "row", gap: 8 },
  acceptBtn: { flex: 1, backgroundColor: "#FF3C50", borderRadius: 6, paddingVertical: 11, alignItems: "center" },
  acceptText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  declineBtn: { flex: 1, backgroundColor: "#161616", borderRadius: 6, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: "#222" },
  declineText: { color: "#444", fontWeight: "600", fontSize: 14 },
});

export default function InboxScreen({ onReceiveProposal, onSwitchTab }) {
  const { user, token }             = useUser();
  const [mode, setMode]             = useState("received");
  const [received, setReceived]     = useState([]);
  const [sent, setSent]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);

  // Cache of fetched users so we don't re-fetch
  const userCache = React.useRef({});

  const fetchUserById = async (userId) => {
    if (userCache.current[userId]) return userCache.current[userId];
    try {
      const u = await api.getUserById(token, userId);
      if (u?.id) userCache.current[userId] = u;
      return u;
    } catch {
      return null;
    }
  };

  const enrichProposals = async (proposals, currentUserId) => {
    return Promise.all(proposals.map(async (p) => {
      const senderId   = p.sender_id;
      const receiverId = p.receiver_id;
      const [sender, receiver] = await Promise.all([
        fetchUserById(senderId),
        fetchUserById(receiverId),
      ]);
      return { ...p, _sender: sender, _receiver: receiver };
    }));
  };

  const fetchAll = useCallback(async () => {
    try {
      const [inbox, outbox] = await Promise.all([
        api.getInbox(token),
        api.getSent(token),
      ]);
      const inboxArr  = Array.isArray(inbox)  ? inbox  : [];
      const outboxArr = Array.isArray(outbox) ? outbox : [];

      const [enrichedInbox, enrichedOutbox] = await Promise.all([
        enrichProposals(inboxArr,  user.id),
        enrichProposals(outboxArr, user.id),
      ]);

      setReceived(enrichedInbox);
      setSent(enrichedOutbox);
    } catch {
      Alert.alert("Error", "Could not load inbox.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRespond = async (proposalId, accept) => {
    try {
      const result = await api.respondToProposal(token, proposalId, accept);
      if (result.id) {
        setReceived((prev) => prev.map((p) => {
          if (p.id !== proposalId) return p;
          return { ...result, _sender: p._sender, _receiver: p._receiver };
        }));
        if (accept) Alert.alert("Matched! 🔥", "Open the chat to connect.");
      } else {
        Alert.alert("Error", result.detail || "Could not respond.");
      }
    } catch {
      Alert.alert("Error", "Network error.");
    }
  };

  const handleOpenChat = (proposal, otherUser) => {
    setActiveChat({ proposal, otherUser });
  };

  const handleViewProfile = (otherUser) => {
    if (!otherUser) return;
    setViewingProfile(otherUser);
  };

  // Profile view modal
  if (viewingProfile) {
    return (
      <View style={s.root}>
        <View style={s.profileHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => setViewingProfile(null)}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={s.profileBody}>
          <Avatar photo={viewingProfile.avatar_url} name={viewingProfile.display_name} size={90} />
          <Text style={s.profileName}>{viewingProfile.display_name}</Text>
          {viewingProfile.age && <Text style={s.profileMeta}>{viewingProfile.age}</Text>}
          {viewingProfile.bio ? <Text style={s.profileBio}>{viewingProfile.bio}</Text> : null}
          {viewingProfile.looking_for && (
            <View style={s.profileChip}>
              <Text style={s.profileChipLabel}>LOOKING FOR</Text>
              <Text style={s.profileChipValue}>{viewingProfile.looking_for}</Text>
            </View>
          )}
          {viewingProfile.interest_tags?.length > 0 && (
            <View style={s.profileTags}>
              {viewingProfile.interest_tags.map((t) => (
                <View key={t} style={s.profileTag}>
                  <Text style={s.profileTagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  }

  if (activeChat) {
    return (
      <ChatScreen
        proposal={activeChat.proposal}
        otherUser={activeChat.otherUser}
        onBack={() => { setActiveChat(null); fetchAll(); }}
      />
    );
  }

  const data = mode === "received" ? received : sent;
  const pendingCount = received.filter((p) => p.status === "pending").length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>INBOX</Text>
          {pendingCount > 0 && (
            <Text style={s.pendingCount}>{pendingCount} waiting for you</Text>
          )}
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={() => { setRefreshing(true); fetchAll(); }}>
          <Text style={s.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={s.toggle}>
        <TouchableOpacity style={[s.toggleBtn, mode === "received" && s.toggleBtnActive]} onPress={() => setMode("received")}>
          <Text style={[s.toggleText, mode === "received" && s.toggleTextActive]}>
            Received {received.length > 0 ? `(${received.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggleBtn, mode === "sent" && s.toggleBtnActive]} onPress={() => setMode("sent")}>
          <Text style={[s.toggleText, mode === "sent" && s.toggleTextActive]}>
            Sent {sent.length > 0 ? `(${sent.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#FF3C50" size="large" /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ProposalCard
              item={item}
              mode={mode}
              onRespond={handleRespond}
              onOpenChat={handleOpenChat}
              onViewProfile={handleViewProfile}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor="#FF3C50" />}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyTitle}>Nothing here</Text>
              <Text style={s.emptySub}>{mode === "received" ? "No one has proposed to you yet" : "You haven't sent any proposals yet"}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808", paddingTop: 60 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 16 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 8 },
  pendingCount: { color: "#FF3C50", fontSize: 12, letterSpacing: 0.5, marginTop: 2 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#111", borderWidth: 1, borderColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#FF3C50", fontSize: 18 },
  toggle: { flexDirection: "row", marginHorizontal: 16, marginBottom: 16, backgroundColor: "#0e0e0e", borderRadius: 8, borderWidth: 1, borderColor: "#1a1a1a", overflow: "hidden" },
  toggleBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#FF3C50" },
  toggleText: { color: "#333", fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  toggleTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 60 },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  emptySub: { color: "#333", fontSize: 14, textAlign: "center", paddingHorizontal: 40 },

  // Profile view
  profileHeader: { paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { paddingVertical: 8 },
  backText: { color: "#FF3C50", fontSize: 16 },
  profileBody: { alignItems: "center", paddingHorizontal: 24, paddingTop: 20, gap: 12 },
  profileName: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  profileMeta: { color: "#555", fontSize: 18 },
  profileBio: { color: "#888", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 4 },
  profileChip: { backgroundColor: "#0e0e0e", borderWidth: 1, borderColor: "#1a1a1a", borderRadius: 10, padding: 14, width: "100%", marginTop: 8 },
  profileChipLabel: { color: "#333", fontSize: 9, letterSpacing: 2, marginBottom: 4 },
  profileChipValue: { color: "#fff", fontSize: 15, fontWeight: "600" },
  profileTags: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 },
  profileTag: { borderWidth: 1, borderColor: "#FF3C50", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,60,80,0.08)" },
  profileTagText: { color: "#FF3C50", fontSize: 12, fontWeight: "600" },
});
