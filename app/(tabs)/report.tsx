/**
 * @file report.tsx
 * @description Weekly summary and credit report PDF generation screen.
 *              Displays 30-day and 90-day microfinance-oriented business summaries,
 *              allows compiling the credit report PDF, and triggers native sharing.
 * @module app/(tabs)/report
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Sharing from 'expo-sharing';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getDB } from '@/lib/db';
import { generateCreditReportPDF } from '@/lib/pdf';
import { CONFIG } from '@/lib/config';

interface SummaryStats {
  revenue30: number;
  transactions30: number;
  revenue90: number;
  transactions90: number;
  topProduct90: string;
}

export default function ReportScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [stats, setStats] = useState<SummaryStats>({
    revenue30: 0,
    transactions30: 0,
    revenue90: 0,
    transactions90: 0,
    topProduct90: 'None',
  });
  const [loading, setLoading] = useState(false);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load summary statistics on screen focus / mount
  const loadReportData = async () => {
    try {
      setLoading(true);
      const db = getDB();

      // 1. Fetch 30-day P&L
      const row30 = await db.getFirstAsync<{ revenue: number; transactions: number }>(
        `SELECT COALESCE(SUM(total_price), 0) as revenue, COUNT(*) as transactions
         FROM sales WHERE created_at >= date('now', '-30 days')`
      );

      // 2. Fetch 90-day P&L
      const row90 = await db.getFirstAsync<{ revenue: number; transactions: number }>(
        `SELECT COALESCE(SUM(total_price), 0) as revenue, COUNT(*) as transactions
         FROM sales WHERE created_at >= date('now', '-90 days')`
      );

      // 3. Fetch top product last 90 days
      const rowTop = await db.getFirstAsync<{ item_name: string; total: number }>(
        `SELECT item_name, SUM(total_price) as total
         FROM sales WHERE created_at >= date('now', '-90 days')
         GROUP BY item_name ORDER BY total DESC LIMIT 1`
      );

      setStats({
        revenue30: row30?.revenue ?? 0,
        transactions30: row30?.transactions ?? 0,
        revenue90: row90?.revenue ?? 0,
        transactions90: row90?.transactions ?? 0,
        topProduct90: rowTop ? `${rowTop.item_name} (${CONFIG.DEFAULT_CURRENCY} ${rowTop.total.toFixed(2)})` : 'None',
      });
    } catch (err) {
      console.error('[report] failed to load report statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  // Handler to generate and open the share dialog for the credit report PDF
  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      setPdfPath(null);

      // Trigger the PDF creation module
      const path = await generateCreditReportPDF(3);
      setPdfPath(path);

      // Verify device has native sharing capabilities
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/pdf',
          dialogTitle: 'StreetBiz Credit Evidence Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        showAlert(
          'PDF Generated Successfully',
          `Your report was generated at:\n${path}\n\nSharing is not available on this device.`
        );
      }
    } catch (err) {
      console.error('[report] credit report generation failed:', err);
      showAlert('Report Error', 'Could not compile PDF report. Make sure you have transaction data.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {/* Screen Header */}
        <Text style={[styles.title, { color: theme.text }]}>Business Reports</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Generate verified credit proof documents and review microfinance insights.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.brand.purple} style={styles.loader} />
        ) : (
          <>
            {/* 30-Day Snapshot Card */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <FontAwesome name="calendar" size={16} color={Colors.brand.green} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Last 30 Days</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Revenue</Text>
                  <Text style={[styles.statValue, { color: Colors.brand.green }]}>
                    {CONFIG.DEFAULT_CURRENCY} {stats.revenue30.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Transactions</Text>
                  <Text style={[styles.statValue, { color: theme.text }]}>{stats.transactions30}</Text>
                </View>
              </View>
            </View>

            {/* 90-Day Credit Profile Card */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <FontAwesome name="line-chart" size={16} color={Colors.brand.purple} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>Last 90 Days (Lending Window)</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Revenue</Text>
                  <Text style={[styles.statValue, { color: Colors.brand.purple }]}>
                    {CONFIG.DEFAULT_CURRENCY} {stats.revenue90.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Top Product</Text>
                  <Text style={[styles.statValueDetail, { color: theme.text }]} numberOfLines={1}>
                    {stats.topProduct90}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Sales Logs</Text>
                  <Text style={[styles.statValueSub, { color: theme.text }]}>{stats.transactions90}</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg Basket Size</Text>
                  <Text style={[styles.statValueSub, { color: theme.text }]}>
                    {CONFIG.DEFAULT_CURRENCY}{' '}
                    {(stats.transactions90 > 0 ? stats.revenue90 / stats.transactions90 : 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Microfinance PDF Generator Module */}
            <View style={[styles.actionCard, { backgroundColor: Colors.brand.purpleLight, borderColor: '#E2DFFF' }]}>
              <FontAwesome name="file-pdf-o" size={36} color={Colors.brand.purple} style={styles.actionIcon} />
              <Text style={styles.actionTitle}>Microfinance Credit Evidence</Text>
              <Text style={styles.actionDesc}>
                Compile a professional, verified PDF ledger of the last 90 days. This document can be sent directly to micro-lenders to prove your business cash flow.
              </Text>

              <TouchableOpacity
                style={[styles.actionButton, isGenerating && styles.disabledButton]}
                onPress={handleGenerateReport}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <FontAwesome name="share-alt" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.actionButtonText}>Generate &amp; Share PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              {pdfPath && (
                <View style={styles.successContainer}>
                  <FontAwesome name="check-circle" size={14} color={Colors.brand.green} />
                  <Text style={styles.successText} numberOfLines={1}>
                    Generated: {pdfPath.split('/').pop()}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.refreshButton} onPress={loadReportData}>
              <FontAwesome name="refresh" size={14} color={theme.textSecondary} />
              <Text style={[styles.refreshText, { color: theme.textSecondary }]}>Reload Metrics</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  loader: {
    marginVertical: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statValueSub: {
    fontSize: 15,
    fontWeight: '600',
  },
  statValueDetail: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  actionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: Colors.brand.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  actionIcon: {
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.brand.purple,
    marginBottom: 6,
  },
  actionDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: '#555566',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: Colors.brand.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    width: '100%',
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.7,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(29, 158, 117, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '100%',
  },
  successText: {
    color: Colors.brand.green,
    fontSize: 12,
    fontWeight: 'bold',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 10,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
