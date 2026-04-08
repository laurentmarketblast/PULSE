import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, StatusBar, Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useUser } from "../context/UserContext";
import Avatar from "../components/Avatar";
import { api } from "../api";

export default function ChatScreen({ proposal, otherUser, onBack }) {
  const { user, token }         = useUser();
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const scrollRef               = useRef(null);
  const pollRef                 = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.getMessages(token, proposal.id);
      if (Array.isArray(data)) setMessages(data);
    } catch {}
    finally { setLoading(false); }
  }, [token, proposal.id]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText("");
    setSending(true);

    const optimistic = {
      id: `temp-${Date.now()}`,
      proposal_id: proposal.id,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
      _pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const sent = await api.sendMessage(token, proposal.id, content);
      if (sent.id) {
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? sent : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        Alert.alert("Error", sent.detail || "Could not send.");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert("Error", "Network error.");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Avatar uri={otherUser?.avatar_url} name={otherUser?.display_name} size={38} />
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{otherUser?.display_name || "..."}</Text>
          <Text style={s.headerSub}>matched · {proposal.activity_tag}</Text>
        </View>
      </View>
      <View style={s.divider} />

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.messageList}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        enableOnAndroid
        enableAutomaticScroll
      >
        {loading ? (
          <View style={s.center}><ActivityIndicator color="#FF3C50" /></View>
        ) : messages.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>Start the conversation</Text>
            <Text style={s.emptySub}>You matched on {proposal.activity_tag}</Text>
          </View>
        ) : (
          messages.map((item, index) => {
            const isMine = item.sender_id === user.id;
            const prevItem = messages[index - 1];
            const showTime = !prevItem ||
              new Date(item.created_at) - new Date(prevItem.created_at) > 5 * 60 * 1000;
            return (
              <View key={item.id}>
                {showTime && <Text style={msg.timeLabel}>{formatTime(item.created_at)}</Text>}
                <View style={[msg.row, isMine ? msg.rowRight : msg.rowLeft]}>
                  <View style={[
                    msg.bubble,
                    isMine ? msg.bubbleMine : msg.bubbleTheirs,
                    item._pending && msg.bubblePending,
                  ]}>
                    <Text style={[msg.text, isMine ? msg.textMine : msg.textTheirs]}>
                      {item.content}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Input inside scroll so it rides above keyboard */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor="#2a2a2a"
            multiline
            maxLength={500}
            selectionColor="#FF3C50"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
          >
            <Text style={s.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const msg = StyleSheet.create({
  timeLabel: { textAlign: "center", color: "#2a2a2a", fontSize: 11, letterSpacing: 0.5, marginVertical: 12 },
  row: { flexDirection: "row", marginBottom: 3, paddingHorizontal: 16 },
  rowRight: { justifyContent: "flex-end" },
  rowLeft:  { justifyContent: "flex-start" },
  bubble: { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine:    { backgroundColor: "#FF3C50", borderBottomRightRadius: 4 },
  bubbleTheirs:  { backgroundColor: "#161616", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#1e1e1e" },
  bubblePending: { opacity: 0.6 },
  text:          { fontSize: 15, lineHeight: 21 },
  textMine:      { color: "#fff" },
  textTheirs:    { color: "#ccc" },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808", paddingTop: 60 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backText: { color: "#FF3C50", fontSize: 22 },
  headerInfo: { flex: 1 },
  headerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerSub:  { color: "#333", fontSize: 11, letterSpacing: 0.5, marginTop: 1 },
  divider: { height: 1, backgroundColor: "#0e0e0e" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  messageList: { flexGrow: 1, paddingTop: 16, paddingBottom: 8 },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  emptySub:   { color: "#2a2a2a", fontSize: 13 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 16,
    borderTopWidth: 1, borderColor: "#0e0e0e",
    gap: 8, backgroundColor: "#080808", marginTop: 8,
  },
  input: {
    flex: 1, backgroundColor: "#111", borderWidth: 1, borderColor: "#1e1e1e",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: "#fff", fontSize: 15, maxHeight: 100,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FF3C50", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#1a1a1a" },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
