import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from storage on app start
  useEffect(() => {
    AsyncStorage.getItem("pulse_user")
      .then((stored) => {
        if (stored) setUserState(JSON.parse(stored));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setUser = (newUser) => {
    if (newUser) {
      AsyncStorage.setItem("pulse_user", JSON.stringify(newUser)).catch(() => {});
    } else {
      AsyncStorage.removeItem("pulse_user").catch(() => {});
    }
    setUserState(newUser);
  };

  if (loading) return null;

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
