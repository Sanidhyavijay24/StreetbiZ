/**
 * @file sales.tsx
 * @description Voice sales logger — record speech, parse via Gemma 4,
 *              and insert transactions into SQLite.
 *              (Stub — voice integration will be implemented next.)
 * @module app/(tabs)/sales
 */

import { StyleSheet, Text, View } from 'react-native';

export default function SalesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Sales Logger</Text>
      <Text>Microphone interface and ledger will go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
});
