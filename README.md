# 🌾 StreetBiz

StreetBiz is an **offline-first financial coach and transaction tracking application** designed specifically for street vendors, micro-merchants, and informal economy traders. 

By running lightweight local AI models (Gemma 4 via Ollama), StreetBiz operates entirely on-device, offering trading insights, inventory scanning, voice-logged sales, and lending credit evidence documents—all without requiring an active internet connection or high-cost subscriptions.

---

## 🚀 Tech Stack

StreetBiz is built on a modern, ultra-fast, and platform-agnostic stack:

*   **Runtime:** [Bun](https://bun.sh/) (exclusively for dependencies, script execution, and test running)
*   **Framework:** [Expo](https://expo.dev/) / React Native (SDK 54)
*   **AI Engine:** Local [Ollama](https://ollama.com/) running `gemma4:e2b` or equivalent lightweight models
*   **Local Database:** [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (SQLite) with a local-storage based emulator for web testing
*   **Speech-to-Text (STT):** `expo-speech-recognition`
*   **Text-to-Speech (TTS):** `expo-speech`
*   **PDF Compiler:** `react-native-html-to-pdf`
*   **Languages:** TypeScript (Strict Mode)

---

## 📦 Folder Structure

```
streetbiz/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab Navigation (Home, Inventory, Sales, Report)
│   │   ├── index.tsx         # Home Dashboard (P&L snapshot, settings, seeder)
│   │   ├── inventory.tsx     # Camera scanner & stock input
│   │   ├── sales.tsx         # Voice transaction logger & sales list
│   │   └── report.tsx        # Weekly/Monthly analytics & PDF credit exporter
│   ├── _layout.tsx           # Root layout (Fonts loader, DB init, modals)
│   └── chat.tsx              # Financial Coach multimodal chat screen
├── components/               # Shareable UI components
├── constants/                # Theme colors and typography tokens
├── lib/
│   ├── alert.ts              # Cross-platform dialog helper (native & web alerts)
│   ├── config.ts             # Runtime environment configuration
│   ├── db.ts                 # SQLite queries and web mock engine
│   ├── ollama.ts             # Gemma 4 LLM client
│   ├── pdf.ts                # PDF credit evidence document template
│   ├── seed.ts               # 30-day realistic transactions generator
│   ├── tools.ts              # Ollama function tool dispatchers (5 tools)
│   ├── types.ts              # Typed interfaces and data models
│   └── voice.ts              # Speech recognition & feedback controllers
├── db.test.ts                # Database and seeder unit tests (Root level)
├── run-tests.ts              # TSConfig-safe Bun test runner script
├── tsconfig.json             # TypeScript configuration
└── package.json              # Script shortcuts and project dependencies
```

---

## ✨ Core Features

1.  **Home Dashboard & Profile Settings:** Displays daily P&L snapshots, weekly sales, and active inventory status. Includes a settings card to configure vendor profiles (category, language, and country tax context).
2.  **Multimodal Stock Scanner:** Take a photo of raw stock or incoming crates; the local AI model parses it and automatically adds/updates quantities in the inventory.
3.  **Voice Sales Logger:** Dictate transactions naturally (e.g., *"I just sold 3 bunches of bananas for 5 dollars"*). The voice transcript is parsed by Ollama, which updates sales tables and deducts stock from inventory automatically.
4.  **Credit Evidence PDF Report:** Generates a professional 3-month credit proof PDF that informal vendors can present to microfinance institutions for loans.
5.  **Local AI Coach:** Speak or type to "Coach StreetBiz" in native languages (English, Swahili, Hindi, Hausa) to get financial advice on tax thresholds, margin calculations, or low stock warnings.
6.  **30-Day Realistic Demo Seeder:** Generate a month's worth of realistic sales history and inventory logs directly from the UI settings.

---

## 🛠️ Testing & Mocks

StreetBiz implements a **zero-dependency test suite** powered by `bun:test` that bypasses Native SQLite and React Native device dependencies during test execution using compile-time mock overrides.

*   **Mock Files:** `react-native-mock.ts`, `expo-sqlite-mock.ts`, `bun-mock.ts`
*   **Types Restoration:** Tests are executed via a custom script (`run-tests.ts`) which temporarily injects mock paths into `tsconfig.json`, executes `bun test`, and restores the original file afterward to ensure your IDE remains clean of red underlines.

---

## 📊 Project Readiness & Roadmap

### Completed Features ✅
*   [x] Database schema creation and lazy initialisation on boot.
*   [x] 30-Day Sales and Inventory simulation seeder.
*   [x] 5 function tool dispatchers for Ollama AI.
*   [x] Cross-platform alert handlers (web dialogs and native alerts).
*   [x] Comprehensive test suite covering P&L, seeder, top products, settings.
*   [x] 100% type-safe compilation (`bun x tsc --noEmit` passes with 0 errors).
*   [x] Fixed tsconfig.json mock mapping leakage in test runner.

### In Progress / Upcoming 🚧
*   [ ] **Dashboard UI Upgrade:** Adding glassmorphic cards, premium gradients, micro-animations, and Google font integration (Outfit/Inter).
*   [ ] **Ollama Integration Validation:** Testing connection resilience, speech-to-text response latency, and translation accuracy in multi-lingual chat.
*   [ ] **Mobile Testing:** Packing app bundles and running on native Android and iOS simulators.

---

## 🚀 Getting Started

### Prerequisites
*   [Bun Runtime](https://bun.sh/) installed locally.
*   [Ollama](https://ollama.com/) running locally with the `gemma4:e2b` (or chosen custom model) loaded.

### Installation
1. Install project dependencies:
   ```bash
   bun install
   ```
2. Configure your environment:
   Copy `.env.example` to `.env` and adjust variables like the local Ollama port if necessary.

### Running the App
*   **Start development server:**
    ```bash
    bun run start
    ```
*   **Run on Web:**
    ```bash
    bun run web
    ```
*   **Run on Android:**
    ```bash
    bun run android
    ```

### Running Tests
Execute the TSConfig-safe unit test suite:
```bash
bun run test
```
