import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("pulse_user"),
      AsyncStorage.getItem("pulse_token"),
    ])
      .then(([storedUser, storedToken]) => {
        if (storedUser) setUserState(JSON.parse(storedUser));
        if (storedToken) setTokenState(storedToken);
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
  };

  if (loading) return null;

  return (
    <UserContext.Provider value={{ user, token, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
