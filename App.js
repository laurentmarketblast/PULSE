import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserProvider, useUser } from "./context/UserContext";
import SignupScreen          from "./app/SignupScreen";
import NearbyScreen          from "./app/NearbyScreen";
import InboxScreen           from "./app/InboxScreen";
import ProfileScreen         from "./app/ProfileScreen";
import ProposalSendScreen    from "./app/ProposalSendScreen";
import ProposalReceiveScreen from "./app/ProposalReceiveScreen";

const TABS = [
  { name: "Nearby",  icon: "radio",         component: NearbyScreen  },
  { name: "Inbox",   icon: "flash",         component: InboxScreen   },
  { name: "Profile", icon: "person-circle", component: ProfileScreen },
];

function MainApp() {
  const [activeTab, setActiveTab]             = useState(0);
  const [proposalSend, setProposalSend]       = useState(null);
  const [proposalReceive, setProposalReceive] = useState(null);

  const ActiveScreen = TABS[activeTab].component;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#080808" }}>
      <View style={{ flex: 1 }}>
        <ActiveScreen
          onSendProposal={(person) => setProposalSend(person)}
          onReceiveProposal={(proposal) => setProposalReceive(proposal)}
          onSwitchTab={(i) => setActiveTab(i)}
        />
      </View>

      <View style={s.tabBar}>
        {TABS.map((tab, i) => {
          const active = activeTab === i;
          return (
            <TouchableOpacity key={tab.name} style={s.tabBtn} onPress={() => setActiveTab(i)}>
              <Ionicons name={tab.icon} size={22} color={active ? "#FF3C50" : "#333"} />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {proposalSend && (
        <ProposalSendScreen
          person={proposalSend}
          onBack={() => setProposalSend(null)}
          onSent={() => { setProposalSend(null); setActiveTab(0); }}
        />
      )}

      {proposalReceive && (
        <ProposalReceiveScreen
          proposal={proposalReceive}
          onBack={() => setProposalReceive(null)}
          onResponded={(result, accepted) => {
            setProposalReceive(null);
            if (accepted) setActiveTab(1);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function RootNav() {
  const { user } = useUser();
  if (user == null) return <SignupScreen />;
  return <MainApp />;
}

export default function App() {
  return (
    <UserProvider>
      <RootNav />
    </UserProvider>
  );
}

const s = StyleSheet.create({
  tabBar: { flexDirection: "row", backgroundColor: "#080808", borderTopWidth: 1, borderTopColor: "#141414", paddingBottom: 8, paddingTop: 10 },
  tabBtn: { flex: 1, alignItems: "center", gap: 4 },
  tabLabel: { fontSize: 10, color: "#333", letterSpacing: 0.5 },
  tabLabelActive: { color: "#FF3C50" },
});
