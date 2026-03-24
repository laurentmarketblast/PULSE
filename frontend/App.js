import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserProvider, useUser } from "./context/UserContext";
import SignupScreen  from "./app/SignupScreen";
import NearbyScreen  from "./app/NearbyScreen";
import InboxScreen   from "./app/InboxScreen";
import ProfileScreen from "./app/ProfileScreen";

const TABS = [
  { name: "Nearby",  icon: "radio",         component: NearbyScreen  },
  { name: "Inbox",   icon: "flash",         component: InboxScreen   },
  { name: "Profile", icon: "person-circle", component: ProfileScreen },
];

function MainApp() {
  const [activeTab, setActiveTab] = useState(0);
  const ActiveScreen = TABS[activeTab].component;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#080808" }}>
      <View style={{ flex: 1 }}>
        <ActiveScreen />
      </View>
      <View style={{ flexDirection: "row", backgroundColor: "#080808", borderTopWidth: 1, borderTopColor: "#141414", paddingBottom: 8, paddingTop: 10 }}>
        {TABS.map((tab, i) => {
          const active = activeTab === i;
          return (
            <TouchableOpacity key={tab.name} style={{ flex: 1, alignItems: "center", gap: 4 }} onPress={() => setActiveTab(i)}>
              <Ionicons name={tab.icon} size={22} color={active ? "#FF3C50" : "#333"} />
              <Text style={{ fontSize: 10, color: active ? "#FF3C50" : "#333", letterSpacing: 0.5 }}>{tab.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
