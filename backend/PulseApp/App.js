import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { UserProvider, useUser } from "./context/UserContext";

import SignupScreen    from "./app/SignupScreen";
import NearbyScreen   from "./app/NearbyScreen";
import InboxScreen    from "./app/InboxScreen";
import ProfileScreen  from "./app/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0D0D0D",
          borderTopColor: "#1a1a1a",
        },
        tabBarActiveTintColor: "#FF2D55",
        tabBarInactiveTintColor: "#555",
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Nearby:  "radio",
            Inbox:   "flash",
            Profile: "person-circle",
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Nearby"  component={NearbyScreen} />
      <Tab.Screen name="Inbox"   component={InboxScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNav() {
  const { user } = useUser();
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Signup" component={SignupScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <UserProvider>
      <RootNav />
    </UserProvider>
  );
}
