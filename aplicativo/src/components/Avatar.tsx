import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

interface Props {
  base64?: string | null;
  size?: number;
  color?: string;
  iconColor?: string;
}

export default function Avatar({ base64, size = 48, color = "#FF2A4D", iconColor = "#fff" }: Props) {
  const radius = size / 2;
  const uri = base64 ?? null;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: uri ? "transparent" : color,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Feather
          name="navigation"
          size={size * 0.42}
          color={iconColor}
          style={{ transform: [{ rotate: "45deg" }] }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
