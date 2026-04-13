import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // DOWN TONIGHT state - shared across all screens
  const [downTonightExpiresAt, setDownTonightExpiresAt] = useState(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("pulse_user"),
      AsyncStorage.getItem("pulse_token"),
      AsyncStorage.getItem("pulse_down_tonight"), // Load DOWN TONIGHT state
    ])
      .then(([storedUser, storedToken, storedDownTonight]) => {
        if (storedUser) setUserState(JSON.parse(storedUser));
        if (storedToken) setTokenState(storedToken);
        if (storedDownTonight) {
          const expiresAt = parseInt(storedDownTonight);
          // Only restore if still active
          if (expiresAt > Date.now()) {
            setDownTonightExpiresAt(expiresAt);
          } else {
            AsyncStorage.removeItem("pulse_down_tonight");
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setUser = (newUser, newToken) => {
    if (newUser) {
      AsyncStorage.setItem("pulse_user", JSON.stringify(newUser)).catch(() => {});
    } else {
      AsyncStorage.removeItem("pulse_user").catch(() => {});
    }
    if (newToken) {
      AsyncStorage.setItem("pulse_token", newToken).catch(() => {});
    } else {
      AsyncStorage.removeItem("pulse_token").catch(() => {});
    }
    setUserState(newUser);
    setTokenState(newToken);
  };

  const logout = () => {
    setUser(null, null);
    setDownTonightExpiresAt(null);
    AsyncStorage.removeItem("pulse_down_tonight");
  };

  // Activate DOWN TONIGHT for 8 hours
  const activateDownTonight = () => {
    const expiresAt = Date.now() + (8 * 60 * 60 * 1000); // 8 hours from now
    setDownTonightExpiresAt(expiresAt);
    AsyncStorage.setItem("pulse_down_tonight", expiresAt.toString());
  };

  // Check if DOWN TONIGHT is currently active
  const isDownTonight = downTonightExpiresAt && downTonightExpiresAt > Date.now();

  if (loading) return null;

  return (
    <UserContext.Provider 
      value={{ 
        user, 
        token, 
        setUser, 
        logout,
        downTonightExpiresAt,
        activateDownTonight,
        isDownTonight,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
