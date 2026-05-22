/**
 * @file sales.tsx
 * @description Voice-activated sales logging interface. Allows street vendors
 *              to log sales by speaking, transcribes using native STT,
 *              processes details using local Gemma 4, and speaks confirmation.
 * @module app/(tabs)/sales
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getAllSales, getDB } from '@/lib/db';
import { voiceSale } from '@/lib/ollama';
import {
  cancelListening,
  requestVoicePermissions,
  speak,
  startListening,
  stopListening,
} from '@/lib/voice';
import type { SaleRecord } from '@/lib/types';
import { CONFIG } from '@/lib/config';

export default function SalesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [statusMsg, setStatusMsg] = useState('Tap mic to start logging');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localeLanguage, setLocaleLanguage] = useState('en-US');

  // Load sales history and language setting on focus/mount
  const loadSalesData = async () => {
    try {
      const history = await getAllSales();
      setSales(history);

      const db = getDB();
      const langRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'language'"
      );
      if (langRow?.value) {
        setLocaleLanguage(langRow.value);
      }
    } catch (err) {
      console.error('[sales] failed to fetch sales setup:', err);
    }
  };

  useEffect(() => {
    loadSalesData();
  }, []);

  useEffect(() => {
    loadSalesData();
  }, [router]);

  const handleStartListening = async () => {
    const hasPermission = await requestVoicePermissions();
    if (!hasPermission) {
      setErrorMsg('Microphone and speech permissions are required to log sales by voice.');
      return;
    }

    setErrorMsg(null);
    setTranscript('');
    setIsListening(true);
    setStatusMsg('Listening... speak now');

    startListening(
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          handleProcessTranscript(text);
        }
      },
      (error) => {
        console.error('[sales] STT error:', error);
        setErrorMsg(error);
        setIsListening(false);
        setStatusMsg('Tap mic to try again');
      },
      () => {
        setIsListening(false);
      },
      localeLanguage
    );
  };

  const handleStopListening = () => {
    stopListening();
    setIsListening(false);
    setStatusMsg('Processing speech...');
    if (transcript.trim()) {
      handleProcessTranscript(transcript);
    } else {
      setStatusMsg('No speech detected. Tap mic to try again.');
    }
  };

  const handleCancelListening = () => {
    cancelListening();
    setIsListening(false);
    setTranscript('');
    setStatusMsg('Cancelled. Tap mic to start');
  };

  const handleProcessTranscript = async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setStatusMsg('Gemma is parsing sale details...');
    try {
      // Send transcript to Gemma for parsing and automatic DB logging
      const responseText = await voiceSale(text);

      // Play vocal confirmation to the vendor
      speak(responseText);

      // Update UI and refresh lists
      setTranscript('');
      setStatusMsg(responseText);
      await loadSalesData();
    } catch (err) {
      console.error('[sales] failed to process voice sale:', err);
      setErrorMsg('Gemma could not process the voice entry. Please check your Ollama connection.');
      setStatusMsg('Tap mic to try again');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Voice Control Section */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {statusMsg}
        </Text>

        {transcript ? (
          <View style={[styles.bubble, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.transcriptText, { color: theme.text }]}>
              "{transcript}"
            </Text>
          </View>
        ) : null}

        {errorMsg ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.buttonContainer}>
          {isListening ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.brand.orange }]}
                onPress={handleCancelListening}
              >
                <FontAwesome name="times" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.micButton, styles.listeningMic]}
                onPress={handleStopListening}
              >
                <FontAwesome name="stop" size={32} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: Colors.brand.green }]}
                onPress={handleStopListening}
              >
                <FontAwesome name="check" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[
                styles.micButton,
                { backgroundColor: Colors.brand.purple },
                isProcessing && styles.disabledButton,
              ]}
              onPress={handleStartListening}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <FontAwesome name="microphone" size={36} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>

        {!isListening && !isProcessing && (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            Try: "Sold 3 bags of rice for 45 dollars" or "Logged two packages of tomatoes for 8"
          </Text>
        )}
      </View>

      {/* Sales History List */}
      <View style={styles.listHeaderContainer}>
        <Text style={[styles.listTitle, { color: theme.text }]}>Sales Ledger</Text>
        <TouchableOpacity onPress={loadSalesData} style={styles.refreshButton}>
          <FontAwesome name="refresh" size={16} color={theme.tint} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sales}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const date = new Date(item.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <View style={[styles.listItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.listItemLeft}>
                <Text style={[styles.itemName, { color: theme.text }]}>{item.item_name}</Text>
                <Text style={[styles.itemDate, { color: theme.textSecondary }]}>
                  {date} &bull; Qty: {item.quantity}
                </Text>
              </View>
              <View style={styles.listItemRight}>
                <Text style={[styles.itemTotal, { color: Colors.brand.green }]}>
                  {item.currency} {item.total_price.toFixed(2)}
                </Text>
                <Text style={[styles.itemUnit, { color: theme.textSecondary }]}>
                  {item.currency} {item.unit_price.toFixed(2)} / unit
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="list-alt" size={48} color={theme.tabIconDefault} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No sales logged today. Tap the mic to record your first transaction!
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },
  bubble: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 15,
  },
  transcriptText: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: '#FDF2F2',
    borderColor: '#FDE8E8',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
  },
  errorText: {
    color: '#E02424',
    fontSize: 13,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 90,
    width: '100%',
  },
  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  listeningMic: {
    backgroundColor: '#EF4444',
    transform: [{ scale: 1.1 }],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 15,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  listHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  listItemLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
  },
  listItemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemUnit: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
});
