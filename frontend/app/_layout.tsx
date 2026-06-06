import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeProvider";
import { ToastProvider } from "@/src/components/Toast";
import { AchievementProvider } from "@/src/components/AchievementProvider";

SplashScreen.preventAutoHideAsync();

function StatusBarWithTheme() {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AchievementProvider>
              <StatusBarWithTheme />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="criar-meta"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="conquistas"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="premium"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="relatorios"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
              </Stack>
            </AchievementProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
