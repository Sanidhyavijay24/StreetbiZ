/**
 * @file _layout.tsx
 * @description Root layout — loads fonts, initialises the SQLite
 *              database, and provides theme + navigation context.
 * @module app/_layout
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { initDB } from '@/lib/db';
import { showAlert } from '@/lib/alert';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before assets are loaded.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Initialise the SQLite database on first mount.
  useEffect(() => {
    initDB()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('[db] initDB failed:', err);
        setDbError(err instanceof Error ? err.message : String(err));
        // Hide splash screen so our error boundary view can render
        SplashScreen.hideAsync().catch(() => {});
      });
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dbReady]);

  if (dbError) {
    return <DatabaseErrorView error={dbError} />;
  }

  if (!loaded || !dbReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function DatabaseErrorView({ error }: { error: string }) {
  const isWeb = Platform.OS === 'web';
  return (
    <View style={styles.errorContainer}>
      <FontAwesome name="database" size={48} color="#D85A30" style={{ marginBottom: 16 }} />
      <Text style={styles.errorTitle}>Database Initialisation Failed</Text>
      <Text style={styles.errorSubtitle}>
        StreetBiz could not spin up its on-device SQLite database engine.
      </Text>
      <View style={styles.errorBox}>
        <Text style={styles.errorBoxHeader}>Common Solutions:</Text>
        <Text style={styles.errorBoxText}>
          1. <Text style={{ fontWeight: 'bold' }}>Use Localhost:</Text> If testing in a web browser, make sure you are accessing the app via <Text style={{ fontWeight: 'bold', color: '#534AB7' }}>http://localhost:8081</Text> rather than a LAN IP address. Browsers block multithreaded database features (SharedArrayBuffer) on non-secure origins.
        </Text>
        <Text style={styles.errorBoxText}>
          2. <Text style={{ fontWeight: 'bold' }}>Run Native Emulator:</Text> Run the app in the iOS Simulator or Android Emulator (`bun run android`) where native SQLite is fully supported out-of-the-box.
        </Text>
        <Text style={styles.errorDetailText}>
          Error: {error}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => {
          if (isWeb) {
            window.location.reload();
          } else {
            showAlert('Please restart the application development server.');
          }
        }}
      >
        <Text style={styles.retryButtonText}>Reload Page</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FAFAFA',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 480,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  errorBoxHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  errorBoxText: {
    fontSize: 13,
    color: '#444444',
    lineHeight: 18,
    marginBottom: 10,
  },
  errorDetailText: {
    fontSize: 11,
    color: '#999999',
    fontStyle: 'italic',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 8,
  },
  retryButton: {
    backgroundColor: '#534AB7',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    elevation: 2,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="chat"
          options={{
            title: 'Financial Coach',
            presentation: 'modal',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
