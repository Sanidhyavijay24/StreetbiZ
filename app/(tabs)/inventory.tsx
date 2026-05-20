/**
 * @file inventory.tsx
 * @description Camera-based multimodal stock scanner.  Captures a
 *              photo, sends it to Gemma 4 for item identification,
 *              and auto-populates the SQLite inventory table.
 * @module app/(tabs)/inventory
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAllInventory } from '../../lib/db';
import { scanPhoto } from '../../lib/ollama';
import type { InventoryItem } from '../../lib/types';

export default function InventoryScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const fetchInventory = async () => {
    const items = await getAllInventory();
    setInventory(items);
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
      const message =
        e instanceof Error ? e.message : 'Failed to scan photo';
      setScanError(message);
      console.error('[inventory] scan error:', e);
    } finally {
      setIsScanning(false);
    }
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>We need camera access to scan inventory</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef}>
        <View style={styles.camOverlay}>
          {scanError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{scanError}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.captureButton}
            onPress={takeAndScan}
            disabled={isScanning}>
            {isScanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Scan Inventory</Text>
            )}
          </TouchableOpacity>
        </View>
      </CameraView>

      <View style={styles.listContainer}>
        <Text style={styles.title}>Current Stock</Text>
        <FlatList
          data={inventory}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>
                {item.quantity} {item.unit}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={{ padding: 20 }}>
              No items yet. Scan some stock!
            </Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  camOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    backgroundColor: '#1D9E75',
    padding: 15,
    borderRadius: 30,
    width: 200,
    alignItems: 'center',
    elevation: 5,
  },
  button: {
    backgroundColor: '#1D9E75',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
  errorBanner: {
    backgroundColor: 'rgba(216, 90, 48, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: { color: '#fff', fontSize: 13 },
  listContainer: { flex: 1, backgroundColor: '#fff' },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
    backgroundColor: '#f0f0f0',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemName: { fontSize: 16, fontWeight: '500' },
  itemQty: { fontSize: 16, color: '#666' },
});
