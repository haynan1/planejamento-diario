import React from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme/ThemeProvider";

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.3,
          textTransform: "uppercase",
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size - 2} color={color} />,
          tabBarButtonTestID: "tab-inicio",
        }}
      />
      <Tabs.Screen
        name="metas"
        options={{
          title: "Metas",
          tabBarIcon: ({ color, size }) => <Feather name="target" size={size - 2} color={color} />,
          tabBarButtonTestID: "tab-metas",
        }}
      />
      <Tabs.Screen
        name="planejamento"
        options={{
          title: "Plano",
          tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size - 2} color={color} />,
          tabBarButtonTestID: "tab-planejamento",
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: "Histórico",
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" size={size - 2} color={color} />
          ),
          tabBarButtonTestID: "tab-historico",
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size - 2} color={color} />,
          tabBarButtonTestID: "tab-perfil",
        }}
      />
    </Tabs>
  );
}
