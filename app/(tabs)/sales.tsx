import { View, Text, StyleSheet } from 'react-native';

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
  title: { fontSize: 20, fontWeight: 'bold' }
});
