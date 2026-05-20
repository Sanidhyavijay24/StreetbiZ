/**
 * @file report.tsx
 * @description Weekly summary and credit report PDF generation screen.
 *              (Stub — PDF generation will be implemented next.)
 * @module app/(tabs)/report
 */

import { StyleSheet, Text, View } from 'react-native';

export default function ReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reports</Text>
      <Text>Weekly summary and credit report PDF gen will go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
});
