# LAN Arcade Platform

LAN Arcade is a portable, local multiplayer arcade platform. It turns a host device (Mobile, Desktop, or Tablet) into a local arcade server that broadcasts itself over MDNS. Players on the same Wi-Fi network can join using a browser client, configure custom house rules, and play synchronized multiplayer games like UNO and Project Coop.

---

## 🛠️ Project Architecture

```
lan_arcade/
├── assets/
│   ├── clients/           # Self-contained HTML/JS game clients served in iframes
│   ├── engines/           # Authoritative JS game logic engines running in QuickJS
│   ├── manifests/         # JSON manifests declaring metadata & settings schemas
│   └── shell/             # Compiled static assets of the Web Shell (Vite React app)
├── lib/
│   ├── database/          # SQLite database via Drift (scores, achievements, events)
│   ├── discovery/         # Network service advertising (NSD/MDNS)
│   ├── kernel/            # HTTP server (shelf), WebSocket bridge, and connection manager
│   ├── plugins/           # JS Engine runtime (QuickJS wrapper via flutter_js)
│   ├── rooms/             # Room state management and SQLite helpers
│   ├── shared/            # Dart data models shared across server layers
│   ├── ui/                # Flutter Server Admin Dashboard & Diagnostics panel
│   └── main.dart          # Flutter entry point
├── test/                  # Test suites (Dart widget tests & Node.js JS engine tests)
└── web_shell/             # React (TSX) Web Shell source code
```

---

## 💡 The Web Shell Asset Pipeline (`assets/shell`)

### How `assets/shell` Works
The client dashboard and room lobby UI is a React app located in the `web_shell/` directory. 
* When you run a production build, Vite compiles the React code and outputs the static assets (`index.html`, JavaScript, CSS) directly into `assets/shell/`.
* Flutter bundles `assets/shell/` as standard app assets defined in `pubspec.yaml`.
* At runtime, the Flutter app extracts these assets to the device's local application documents directory (under `shell_assets/`) using `AssetExtractor`.
* The server (`shelf` inside `KernelRuntime`) serves these files locally on port `8080` (e.g. `http://<host-ip>:8080/`).

### FAQ: Should I clear `assets/shell`?
**No, you do not need to clear or modify the files inside `assets/shell` manually.**
If you make any changes to the React code inside the `web_shell/` directory:
1. Navigate to the `web_shell/` directory: `cd web_shell`
2. Run the build script: `npm run build`
Vite's build tool will automatically clear `assets/shell` and replace it with the fresh production build.

---

## 🚀 Getting Started

### Prerequisites
* Flutter SDK (Stable)
* Node.js (v18+) & npm

### Running the Flutter Host
To launch the admin server dashboard on your host device:
1. Run `flutter pub get` in the root directory.
2. Run the app: `flutter run` (or launch via your IDE).

### Developing the Web Client
To modify the web client dashboard with hot-reloading:
1. Navigate to the web shell: `cd web_shell`
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`
4. Compile for production once changes are done: `npm run build`

---

## 🧪 Testing

The platform maintains two test suites to guarantee database, connection, and gameplay logic remain intact:

### 1. Game Engine Integration Tests (JavaScript / Node.js)
Tests UNO house rules (stacking, jump-ins, hand swaps) and Project Coop solver algorithms inside a mock QuickJS sandbox:
```bash
# Run from the project root
node test/engine_tests.js
```

### 2. Flutter Host Tests (Dart)
Runs widget tests and asserts the UI and engine initialization behave correctly:
```bash
# Run from the project root
flutter test
```

---

## 🔌 Writing a Game Plugin

Every game plugin consists of three core files placed in `assets/`:

1. **Manifest File** (`assets/manifests/<game-id>.json`):
   Defines player count bounds, required permissions (e.g. `timers`), and custom settings schemas (presets, booleans, select dropdowns) that are dynamically drawn in the host's room lobby.
2. **Web Client** (`assets/clients/<game-id>.html`):
   Self-contained HTML5 Canvas/DOM interface. Communicates with the platform parent shell using the `window.parent.Arcade` global SDK.
3. **Server Logic** (`assets/engines/<game-id>.js`):
   Authoritative gameplay logic. Exposes game state handlers (`onInit`, `onAction`, `onTick`) to process player actions and synchronize public/private state.

