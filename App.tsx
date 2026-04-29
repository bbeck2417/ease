import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Quicksand_400Regular,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";

import StruggleScreen from "./src/screens/StruggleScreen";
import ResourceScreen from "./src/screens/ResourceScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import MoodScreen from "./src/screens/MoodScreen";
import { colors } from "./src/theme/colors";

export type RootStackParamList = {
  Struggle: undefined;
  Resources: undefined;
  Settings: undefined;
  Mood: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const DarkAppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.dark, // Set to #2D3436
  },
};

export default function App() {
  // Load fonts using the useFonts hook
  const [fontsLoaded] = useFonts({
    "Quicksand-Regular": Quicksand_400Regular,
    "Quicksand-Bold": Quicksand_700Bold,
  });

  // Wait for fonts to load before rendering the app
  if (!fontsLoaded) {
    return null; // Or a custom Loading/SplashScreen
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkAppTheme}>
        <Stack.Navigator
          initialRouteName="Struggle"
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: colors.dark },
          }}
        >
          <Stack.Screen name="Struggle" component={StruggleScreen} />
          <Stack.Screen name="Resources" component={ResourceScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Mood" component={MoodScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
