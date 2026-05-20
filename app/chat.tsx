/**
 * @file chat.tsx
 * @description Financial coaching chat — free-text Q&A powered by
 *              Gemma 4 with live ledger context injection.
 *              (Stub — full chat UI will be implemented next.)
 * @module app/chat
 */

import { StyleSheet, Text, View } from 'react-native';

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Financial Coach</Text>
      <Text>Gemma 4 chat interface will go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
});
