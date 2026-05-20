/**
 * @file index.tsx
 * @description Home dashboard — daily P&L snapshot with metric cards.
 *              (Stub — will be fully implemented in the next phase.)
 * @module app/(tabs)/index
 */

import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Dashboard</Text>
      <Text>Daily P&L snapshot will go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
