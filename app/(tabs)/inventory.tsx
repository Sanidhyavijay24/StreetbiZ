/**
 * @file inventory.tsx
 * @description Camera-based multimodal stock scanner. Captures a photo,
 *              sends it to Gemma 4 for item identification, and auto-populates
 *              the SQLite inventory table. Uses themed brand colors.
 * @module app/(tabs)/inventory
 */

import React, { useEffect, useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getAllInventory } from '@/lib/db';
import { scanPhoto } from '@/lib/ollama';
import type { InventoryItem } from '@/lib/types';

export default function InventoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const fetchInventory = async () => {
    try {
      const items = await getAllInventory();
      setInventory(items);
    } catch (err) {
      console.error('[inventory] failed to fetch inventory:', err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const takeAndScan = async () => {
    if (!cameraRef.current || isScanning) return;
    try {
      setIsScanning(true);
      setScanError(null);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });
      if (photo?.base64) {
        await scanPhoto(photo.base64);
        await fetchInventory();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to scan photo';
      setScanError(message);
      console.error('[inventory] scan error:', e);
    } finally {
      setIsScanning(false);
    }
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fallbackContainer, { backgroundColor: theme.background }]}>
        <FontAwesome name="camera" size={48} color={theme.tabIconDefault} style={{ marginBottom: 16 }} />
        <Text style={[styles.fallbackText, { color: theme.text }]}>
          We need camera access to photograph and scan stock items automatically.
        </Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: Colors.brand.green }]} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <CameraView style={styles.camera} ref={cameraRef}>
        <View style={styles.camOverlay}>
          {scanError && (
            <View style={[styles.errorBanner, { backgroundColor: Colors.brand.orange }]}>
              <FontAwesome name="exclamation-circle" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{scanError}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.captureButton, { backgroundColor: Colors.brand.green }]}
            onPress={takeAndScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="qrcode" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Scan Inventory</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </CameraView>

      <View style={[styles.listContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.listHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Current Stock</Text>
          <TouchableOpacity onPress={fetchInventory} style={styles.refreshBtn}>
            <FontAwesome name="refresh" size={14} color={theme.tint} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={inventory}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.listItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.itemQty, { color: theme.textSecondary }]}>
                {item.quantity} {item.unit}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome name="archive" size={32} color={theme.tabIconDefault} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No items recorded yet. Use the camera above to scan your first product stock!
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  camOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    width: 220,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallbackText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    maxWidth: '90%',
  },
  errorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemQty: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
