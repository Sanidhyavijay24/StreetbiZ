/**
 * @file index.tsx
 * @description Home dashboard — Daily P&L snapshots, quick action grid,
 *              financial coach prompt banners, and inline profile editor.
 * @module app/(tabs)/index
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getDB, getPnL, getTopSellingItem, getAllInventory } from '@/lib/db';
import { CONFIG } from '@/lib/config';
import { showAlert } from '@/lib/alert';
import { seedDemoData } from '@/lib/seed';

interface DashboardData {
  vendorName: string;
  businessType: string;
  country: string;
  todayRevenue: number;
  todayTransactions: number;
  weekRevenue: number;
  topProduct: string;
  stockCount: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [loading, setLoading] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  
  // Settings edit state
  const [tempName, setTempName] = useState('');
  const [tempBiz, setTempBiz] = useState('');
  const [tempCountry, setTempCountry] = useState('');
  const [tempLanguage, setTempLanguage] = useState('en-US');

  const [data, setData] = useState<DashboardData>({
    vendorName: 'StreetBiz Vendor',
    businessType: 'Retail Store',
    country: 'United States',
    todayRevenue: 0,
    todayTransactions: 0,
    weekRevenue: 0,
    topProduct: 'None',
    stockCount: 0,
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const db = getDB();

      // 1. Load Settings
      const nameRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'vendor_name'"
      );
      const bizRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'business_type'"
      );
      const countryRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'country'"
      );
      const langRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'language'"
      );

      const vendorName = nameRow?.value || 'StreetBiz Vendor';
      const businessType = bizRow?.value || 'General Retail';
      const country = countryRow?.value || 'United States';
      const language = langRow?.value || 'en-US';

      // Set edit inputs
      setTempName(vendorName);
      setTempBiz(businessType);
      setTempCountry(country);
      setTempLanguage(language);

      // 2. Fetch P&L metrics
      const todayPnL = await getPnL('today');
      const weekPnL = await getPnL('week');

      // 3. Fetch top product
      const topItem = await getTopSellingItem();

      // 4. Fetch stock metrics
      const stock = await getAllInventory();
      const stockCount = stock.reduce((sum, item) => sum + (item.quantity > 0 ? 1 : 0), 0);

      setData({
        vendorName,
        businessType,
        country,
        todayRevenue: todayPnL.revenue,
        todayTransactions: todayPnL.transactions,
        weekRevenue: weekPnL.revenue,
        topProduct: topItem ? `${topItem.item_name} (${CONFIG.DEFAULT_CURRENCY} ${topItem.total.toFixed(2)})` : 'None',
        stockCount,
      });
    } catch (err) {
      console.error('[home] failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Proactively reload data when screen is focused (can be triggered manually or during nav)
  useEffect(() => {
    const db = getDB();
    // Watch for focus changes
    loadDashboardData();
  }, [router]);

  const handleSaveSettings = async () => {
    if (!tempName.trim()) {
      showAlert('Validation Error', 'Vendor name is required.');
      return;
    }
    try {
      const db = getDB();
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('vendor_name', ?)", [tempName]);
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('business_type', ?)", [tempBiz]);
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('country', ?)", [tempCountry]);
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('language', ?)", [tempLanguage]);
      
      setEditingSettings(false);
      showAlert('Success', 'Business profile updated successfully!');
      await loadDashboardData();
    } catch (err) {
      console.error('[home] failed to save settings:', err);
      showAlert('Database Error', 'Could not save profile details.');
    }
  };

  const handleSeedData = async () => {
    showAlert(
      'Seed Demo Data',
      'This will clear all current sales and inventory records and generate 30 days of realistic history. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Data',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await seedDemoData();
              showAlert('Success', '30-day demo data seeded successfully!');
              await loadDashboardData();
            } catch (err) {
              console.error('[home] seeding failed:', err);
              showAlert('Seeding Error', 'Could not seed database records.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        
        {/* Welcome Header & Profile Edit Toggle */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.welcomeTitle, { color: theme.textSecondary }]}>Welcome Back,</Text>
            <Text style={[styles.vendorName, { color: theme.text }]} numberOfLines={1}>
              {data.vendorName}
            </Text>
            <Text style={[styles.businessTag, { color: theme.tint }]}>
              🌾 {data.businessType} &bull; {data.country}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.profileButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setEditingSettings(!editingSettings)}
          >
            <FontAwesome name="cog" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Collapsible Profile Settings Form */}
        {editingSettings && (
          <View style={[styles.settingsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.settingsTitle, { color: theme.text }]}>Edit Business Profile</Text>
            
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Vendor Name</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
              value={tempName}
              onChangeText={setTempName}
              placeholder="e.g. Sanidhya Grocery Store"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Business Category</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
              value={tempBiz}
              onChangeText={setTempBiz}
              placeholder="e.g. Produce Retailer"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Country (Tax Threshold Context)</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
              value={tempCountry}
              onChangeText={setTempCountry}
              placeholder="e.g. United States"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Preferred Language</Text>
            <View style={styles.languageRow}>
              {[
                { label: '🇺🇸 EN', code: 'en-US' },
                { label: '🇮🇳 HI', code: 'hi-IN' },
                { label: '🇰🇪 SW', code: 'sw-KE' },
                { label: '🇳🇬 HA', code: 'ha-NG' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageButton,
                    { borderColor: theme.border },
                    tempLanguage === lang.code && { backgroundColor: Colors.brand.purple, borderColor: Colors.brand.purple }
                  ]}
                  onPress={() => setTempLanguage(lang.code)}
                >
                  <Text style={[
                    styles.languageButtonText,
                    { color: theme.textSecondary },
                    tempLanguage === lang.code && { color: '#fff', fontWeight: 'bold' }
                  ]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 15 }]} />
            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginBottom: 8 }]}>Demo Tools</Text>
            <TouchableOpacity
              style={[styles.seedButton, { borderColor: Colors.brand.purple }]}
              onPress={handleSeedData}
            >
              <FontAwesome name="database" size={14} color={Colors.brand.purple} style={{ marginRight: 8 }} />
              <Text style={styles.seedButtonText}>Seed 30-Day Demo Data</Text>
            </TouchableOpacity>

            <View style={styles.settingsActions}>
              <TouchableOpacity
                style={[styles.settingsButton, { backgroundColor: theme.border }]}
                onPress={() => setEditingSettings(false)}
              >
                <Text style={[styles.settingsBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsButton, { backgroundColor: Colors.brand.green }]}
                onPress={handleSaveSettings}
              >
                <Text style={[styles.settingsBtnText, { color: '#fff' }]}>Save Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Today's Cash Book (P&L Card) */}
        <View style={[styles.pnlCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <FontAwesome name="money" size={16} color={Colors.brand.green} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Today's Cash Book</Text>
          </View>
          
          <View style={styles.metricsWrapper}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Revenue</Text>
              <Text style={[styles.revenueText, { color: Colors.brand.green }]}>
                {CONFIG.DEFAULT_CURRENCY} {data.todayRevenue.toFixed(2)}
              </Text>
            </View>
            <View style={styles.metricItemRight}>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Transactions</Text>
              <Text style={[styles.transactionsText, { color: theme.text }]}>
                {data.todayTransactions}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.weeklySumRow}>
            <Text style={[styles.weeklyLabel, { color: theme.textSecondary }]}>7-Day Total Sales</Text>
            <Text style={[styles.weeklyValue, { color: theme.text }]}>
              {CONFIG.DEFAULT_CURRENCY} {data.weekRevenue.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Prominent Chat Coach Banner */}
        <TouchableOpacity
          style={[styles.coachBanner, { backgroundColor: Colors.brand.purple }]}
          onPress={() => router.push('/chat')}
        >
          <View style={styles.coachBannerLeft}>
            <FontAwesome name="comments-o" size={32} color="#fff" />
            <View style={styles.coachBannerTextWrapper}>
              <Text style={styles.coachBannerTitle}>Talk to Coach StreetBiz</Text>
              <Text style={styles.coachBannerDesc}>
                Ask about low stock, calculate tax, or evaluate monthly cash book trends.
              </Text>
            </View>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#fff" style={styles.coachArrow} />
        </TouchableOpacity>

        {/* Stock Status & Top Seller Card */}
        <View style={styles.statusGrid}>
          <View style={[styles.statusItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <FontAwesome name="cubes" size={16} color={Colors.brand.orange} style={{ marginBottom: 4 }} />
            <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Active Products</Text>
            <Text style={[styles.statusValue, { color: theme.text }]}>{data.stockCount} Items</Text>
          </View>
          <View style={[styles.statusItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <FontAwesome name="trophy" size={16} color={Colors.brand.amber} style={{ marginBottom: 4 }} />
            <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Top Product (7d)</Text>
            <Text style={[styles.statusValueSub, { color: theme.text }]} numberOfLines={1}>
              {data.topProduct}
            </Text>
          </View>
        </View>

        {/* Quick Actions Tray */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/(tabs)/inventory')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: Colors.brand.greenLight }]}>
              <FontAwesome name="camera" size={18} color={Colors.brand.green} />
            </View>
            <Text style={[styles.actionCardTitle, { color: theme.text }]}>Scan Stock</Text>
            <Text style={[styles.actionCardDesc, { color: theme.textSecondary }]}>
              Photograph inventory
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/(tabs)/sales')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: Colors.brand.purpleLight }]}>
              <FontAwesome name="microphone" size={18} color={Colors.brand.purple} />
            </View>
            <Text style={[styles.actionCardTitle, { color: theme.text }]}>Log Sales</Text>
            <Text style={[styles.actionCardDesc, { color: theme.textSecondary }]}>
              Use voice transcript
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/(tabs)/report')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FFF0EA' }]}>
              <FontAwesome name="file-pdf-o" size={18} color={Colors.brand.orange} />
            </View>
            <Text style={[styles.actionCardTitle, { color: theme.text }]}>View Reports</Text>
            <Text style={[styles.actionCardDesc, { color: theme.textSecondary }]}>
              Lending credit proof
            </Text>
          </TouchableOpacity>
        </View>

        {/* Refresh Dashboard Button */}
        <TouchableOpacity style={styles.refreshButton} onPress={loadDashboardData}>
          <FontAwesome name="refresh" size={14} color={theme.textSecondary} />
          <Text style={[styles.refreshText, { color: theme.textSecondary }]}>Refresh Dashboard</Text>
        </TouchableOpacity>

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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  businessTag: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    elevation: 2,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  settingsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  settingsButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  settingsBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  pnlCard: {
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
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  metricsWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricItem: {
    flex: 1,
  },
  metricItemRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  revenueText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  transactionsText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  weeklySumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeklyLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  weeklyValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  coachBanner: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
    shadowColor: Colors.brand.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  coachBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  coachBannerTextWrapper: {
    flex: 1,
  },
  coachBannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  coachBannerDesc: {
    color: '#E2DFFF',
    fontSize: 12,
    lineHeight: 16,
  },
  coachArrow: {
    marginLeft: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statusItem: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-start',
    elevation: 1,
  },
  statusLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  statusValueSub: {
    fontSize: 13,
    fontWeight: 'bold',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
    textAlign: 'center',
  },
  actionCardDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 12,
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
  languageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  languageButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 20,
    borderStyle: 'dashed',
  },
  seedButtonText: {
    color: Colors.brand.purple,
    fontWeight: 'bold',
    fontSize: 13,
  },
});
