/**
 * @file chat.tsx
 * @description Financial coaching chat — interactive business coach powered by
 *              local Gemma 4. Injects live inventory and sales context, executes
 *              tools dynamically (e.g. tax thresholds, P&L aggregation), and
 *              provides Text-to-Speech voice responses.
 * @module app/chat
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getDB, getAllInventory, getPnL, getTopSellingItem } from '@/lib/db';
import { chat } from '@/lib/ollama';
import { dispatchTool } from '@/lib/tools';
import { speak, stopSpeaking } from '@/lib/voice';
import type { OllamaMessage } from '@/lib/types';
import { CONFIG } from '@/lib/config';

// Suggestion chips to help the vendor start a conversation quickly
const SUGGESTIONS = [
  { id: '1', label: '📊 How are my sales today?', text: 'Give me a summary of my sales and P&L for today.' },
  { id: '2', label: '🌾 Check low stock', text: 'Check my inventory. Do I have any low stock items that need reordering?' },
  { id: '3', label: '💰 Do I need to pay taxes?', text: 'Explain if I need to pay or register for taxes based on my revenue in the United States.' },
  { id: '4', label: '📋 Build credit report', text: 'Generate a 3-month credit report for my business.' },
];

export default function ChatScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [messages, setMessages] = useState<OllamaMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Initialize with a welcome message from the coach
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content:
          "Hello! I am your StreetBiz Financial Coach. I can help you analyze your sales, track stock levels, calculate profits, or explain tax rules. What would you like to check today?",
      },
    ]);
  }, []);

  // Auto-scroll list to bottom when messages or typing status changes
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  /**
   * Fetches latest database state and compiles the master system prompt context.
   */
  const buildSystemPrompt = async (): Promise<string> => {
    try {
      const db = getDB();
      // Fetch settings
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
      const businessType = bizRow?.value || 'Retail Store';
      const country = countryRow?.value || 'United States';
      const language = langRow?.value || 'en-US';

      // Fetch financial metrics
      const todayPnL = await getPnL('today');
      const weekPnL = await getPnL('week');
      const topItem = await getTopSellingItem();

      // Fetch inventory
      const stock = await getAllInventory();

      return `You are StreetBiz, a knowledgeable and empathetic financial coach for micro-merchants and informal street vendors.
You are helping the vendor manage their business.

Here is the LIVE business state from the vendor's device database:
- Vendor Name: ${vendorName}
- Business Type: ${businessType}
- Country: ${country}
- Currency: ${CONFIG.DEFAULT_CURRENCY}
- Preferred Language Code: ${language}

Performance Metrics:
- Today's Revenue: ${CONFIG.DEFAULT_CURRENCY} ${todayPnL.revenue.toFixed(2)} (${todayPnL.transactions} transactions)
- Weekly Revenue: ${CONFIG.DEFAULT_CURRENCY} ${weekPnL.revenue.toFixed(2)} (${weekPnL.transactions} transactions)
- Top Product (last 7 days): ${topItem ? `${topItem.item_name} (${CONFIG.DEFAULT_CURRENCY} ${topItem.total.toFixed(2)})` : 'None'}

Current Stock Levels:
${
  stock.length > 0
    ? stock.map((s) => `- ${s.name}: ${s.quantity} ${s.unit} (Price: ${CONFIG.DEFAULT_CURRENCY} ${s.unit_price.toFixed(2)})`).join('\n')
    : 'No items in inventory.'
}

Coaching Rules:
1. Keep replies friendly, practical, and highly simplified. Avoid heavy corporate slang or accounting jargon.
2. Provide direct answers in the vendor's preferred language (Language Code: ${language}). If the language code is 'sw-KE', respond in Swahili. If 'hi-IN', respond in Hindi. If 'ha-NG', respond in Hausa. Otherwise default to simple English.
3. If the user asks about calculations, tax rules, P&L summaries, or reports, make use of your tools.
4. Keep paragraphs short (maximum 2-3 sentences each) since the vendor is reading on a mobile device or listening to voice playback.
5. If a tool returns a path to a PDF report, highlight to the vendor that they can view and share it from the "Report" tab.
`;
    } catch (err) {
      console.error('[chat] failed to build system prompt context:', err);
      return 'You are StreetBiz, a business coach for street vendors. Keep answers simple.';
    }
  };

  /**
   * Triggers the Ollama chat completion and executes returned tool calls in an iterative loop.
   */
  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isTyping) return;

    if (!textToSend) {
      setInputText('');
    }
    setErrorMsg(null);
    stopSpeaking();

    // 1. Append user message to list
    const userMsg: OllamaMessage = { role: 'user', content: query };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const db = getDB();
      const liveSystemPrompt = await buildSystemPrompt();

      let currentHistory = [...updatedMessages];
      let assistantMsg: OllamaMessage | null = null;
      let loopCount = 0;
      const maxLoops = 3;

      while (loopCount < maxLoops) {
        // Prepare full payload with system prompt
        const payload: OllamaMessage[] = [
          { role: 'system', content: liveSystemPrompt },
          ...currentHistory,
        ];

        // Call Gemma model
        assistantMsg = await chat(payload);

        // If no tool calls, this is the final reply
        if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
          break;
        }

        // We have tool calls! Add assistant's tool-call structure to the history first
        currentHistory.push(assistantMsg);
        setMessages([...currentHistory]);

        // Process each tool call sequentially
        for (const toolCall of assistantMsg.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[chat] executing tool: ${toolName}`, toolArgs);

          // Dispatch database action
          const result = await dispatchTool(toolName, toolArgs, db);

          // Append tool execution response to feed back to Gemma
          currentHistory.push({
            role: 'tool',
            name: toolName,
            content: JSON.stringify(result),
          });
        }

        setMessages([...currentHistory]);
        loopCount++;
      }

      // Add final assistant text message to the display history
      if (assistantMsg) {
        currentHistory.push(assistantMsg);
        setMessages(currentHistory);

        // Speak aloud if enabled
        if (ttsEnabled && typeof assistantMsg.content === 'string') {
          speak(assistantMsg.content);
        }
      }
    } catch (err) {
      console.error('[chat] chat execution loop error:', err);
      setErrorMsg('Could not connect to Gemma. Please ensure Ollama is running locally.');
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * Render custom inline pill for tool-calling actions
   */
  const renderToolPill = (msg: OllamaMessage) => {
    let text = 'Working...';
    let icon: 'cog' | 'calculator' | 'file-text' | 'archive' = 'cog';

    if (msg.role === 'assistant' && msg.tool_calls) {
      const firstCall = msg.tool_calls[0]?.function.name;
      if (firstCall === 'get_pnl_summary') {
        text = 'Analyzing sales database...';
        icon = 'calculator';
      } else if (firstCall === 'add_inventory_item') {
        text = 'Updating inventory list...';
        icon = 'archive';
      } else if (firstCall === 'generate_credit_report') {
        text = 'Compiling credit report PDF...';
        icon = 'file-text';
      } else if (firstCall === 'explain_tax_threshold') {
        text = 'Calculating tax thresholds...';
        icon = 'calculator';
      }
    } else if (msg.role === 'tool') {
      text = `Retrieved details from database`;
      icon = 'cog';
    }

    return (
      <View style={styles.toolPillContainer}>
        <View style={[styles.toolPill, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <FontAwesome name={icon} size={12} color={Colors.brand.purple} style={styles.toolPillIcon} />
          <Text style={[styles.toolPillText, { color: theme.textSecondary }]}>{text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* TTS Toggle Header */}
        <View style={[styles.header, { borderColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <FontAwesome name="support" size={20} color={Colors.brand.purple} />
            <Text style={[styles.headerTitle, { color: theme.text }]}>Coach StreetBiz</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.ttsButton,
              { backgroundColor: ttsEnabled ? Colors.brand.greenLight : theme.border },
            ]}
            onPress={() => {
              if (ttsEnabled) stopSpeaking();
              setTtsEnabled(!ttsEnabled);
            }}
          >
            <FontAwesome
              name={ttsEnabled ? 'volume-up' : 'volume-off'}
              size={16}
              color={ttsEnabled ? Colors.brand.green : theme.textSecondary}
            />
            <Text
              style={[
                styles.ttsText,
                { color: ttsEnabled ? Colors.brand.green : theme.textSecondary },
              ]}
            >
              {ttsEnabled ? 'Voice ON' : 'Voice OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Message Thread */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            // Handle Tool calls display
            if ((item.role === 'assistant' && item.tool_calls) || item.role === 'tool') {
              return renderToolPill(item);
            }

            // Normal chat messages
            const isUser = item.role === 'user';
            if (!item.content || typeof item.content !== 'string') return null;

            return (
              <View style={[styles.bubbleWrapper, isUser ? styles.userWrapper : styles.coachWrapper]}>
                {!isUser && (
                  <View style={[styles.avatar, { backgroundColor: Colors.brand.green }]}>
                    <FontAwesome name="user-md" size={14} color="#fff" />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? { backgroundColor: Colors.brand.purple, borderBottomRightRadius: 4 }
                      : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderBottomLeftRadius: 4 },
                  ]}
                >
                  <Text style={[styles.messageText, { color: isUser ? '#fff' : theme.text }]}>
                    {item.content}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color={Colors.brand.purple} />
                <Text style={[styles.typingText, { color: theme.textSecondary }]}>
                  Gemma is thinking...
                </Text>
              </View>
            ) : null
          }
        />

        {/* Connection Error Notification */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <FontAwesome name="exclamation-circle" size={14} color="#E02424" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Suggestions Tray */}
        {messages.length <= 2 && !isTyping && (
          <View style={styles.suggestionsContainer}>
            <Text style={[styles.suggestionsTitle, { color: theme.textSecondary }]}>
              Suggested Questions
            </Text>
            <FlatList
              horizontal
              data={SUGGESTIONS}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.suggestionChip,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => handleSendMessage(item.text)}
                >
                  <Text style={[styles.suggestionText, { color: theme.text }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
            placeholder="Ask your coach..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            editable={!isTyping}
            onSubmitEditing={() => handleSendMessage()}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() ? Colors.brand.purple : theme.border },
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isTyping}
          >
            <FontAwesome name="send" size={16} color={inputText.trim() ? '#fff' : theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ttsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 6,
  },
  ttsText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '85%',
    gap: 8,
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  coachWrapper: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  toolPillContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  toolPillIcon: {
    marginRight: 2,
  },
  toolPillText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingLeft: 32,
    marginTop: 4,
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDF2F2',
    borderColor: '#FDE8E8',
    borderWidth: 1,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#E02424',
    fontSize: 13,
  },
  suggestionsContainer: {
    paddingVertical: 12,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
