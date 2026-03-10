import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getAvatarColors, getInitial } from "../utils/avatar";

export default function Avatar({ uri, name, size = 48, fontSize }) {
  const colors = getAvatarColors(name);
  const initial = getInitial(name);
  const fSize = fontSize || size * 0.42;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.initial, { fontSize: fSize }]}>{initial}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: "#111" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  initial: { color: "#fff", fontWeight: "700" },
});
