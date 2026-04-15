# PaintYourPhoto — Flutter Android App Section (Preexisting App Improvement)

## Overview

You are adding a **PaintYourPhoto** section to the existing Fotonix Flutter Android app. The app already has a Stencil painting guide with a camera-based colour-mixing feature. You will **reuse the existing camera colour-matching code** from the stencil section and adapt it for PaintYourPhoto.

PaintYourPhoto lets users upload a photo on the web app (fotonix.co.uk/tools/paint-by-numbers), which generates a numbered paint-by-numbers design. After purchasing, the order is saved to Firebase. In the Android app, users can view their PBN orders, see the original image, the paint-by-numbers breakdown, select individual colour regions, and use the camera-based colour mixer to match real paint to the target colour.

---

## Firebase Data Structure for PBN Orders

### Path: `users/{userId}/pbnOrders/{orderId}`

```json
{
  "orderId": "PAYPAL_ORDER_ID",
  "timestamp": 1732636800000,
  "orderType": "pbn",
  "paypalStatus": "COMPLETED",
  "productKey": "30x40",
  "productLabel": "Medium Canvas 30×40 cm",
  "materialType": "canvas",
  "selectedSize": "30x40",
  "pricing": {
    "subtotal": "25.99",
    "deliveryFee": "4.95",
    "total": "30.94"
  },
  "storageUrls": [
    { "type": "svg", "url": "https://firebasestorage.googleapis.com/.../pbn-123.svg" },
    { "type": "hd-png", "url": "https://firebasestorage.googleapis.com/.../pbn-hd-123.png" },
    { "type": "outline-svg", "url": "https://firebasestorage.googleapis.com/.../pbn-outline-123.svg" },
    { "type": "palette-svg", "url": "https://firebasestorage.googleapis.com/.../pbn-palette-123.svg" }
  ],
  "metadata": {
    "numColors": 18,
    "detailLevel": 50,
    "regionCount": 142,
    "analysisWidth": 1024,
    "analysisHeight": 768,
    "originalImageUrl": "https://firebasestorage.googleapis.com/.../original-123.png"
  },
  "paletteData": [
    { "number": 6, "hex": "#f5deb3", "name": "Warm Sand" },
    { "number": 12, "hex": "#8b4513", "name": "Raw Umber" },
    { "number": 24, "hex": "#d4a574", "name": "Peach" }
  ]
}
```

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | String | PayPal order ID (or `TEST-{ts}` for test orders) |
| `timestamp` | int | Unix milliseconds when order was placed |
| `productKey` | String | Size key: `20x20`, `20x30`, `30x40`, `a4`, `a3` |
| `productLabel` | String | Human-readable label |
| `materialType` | String | `canvas` or `paper` |
| `pricing.total` | String | Total paid in GBP |
| `storageUrls` | List | Firebase Storage download URLs for SVG, HD PNG, outline SVG, palette SVG |
| `metadata.numColors` | int | Number of palette colours used |
| `metadata.detailLevel` | int | 0–100 (0 = max detail, 100 = simplified) |
| `metadata.regionCount` | int | Number of paintable regions |
| `metadata.originalImageUrl` | String | Firebase Storage URL of the original uploaded photo |
| `paletteData` | List | Pre-computed palette: each entry has `number` (matches SVG labels), `hex`, and `name` |

### Storage URLs Explained

- **`svg`** — Full colour PBN SVG with numbered regions and filled colours
- **`hd-png`** — High-resolution PNG render of the PBN SVG (for printing / colour reference)
- **`outline-svg`** — Black outline SVG with region numbers only (no colour fills) — this is the actual painting template
- **`palette-svg`** — Colour key legend SVG showing each colour number, hex, and name in a printable grid

---

## What You Need to Build

### 1. PaintYourPhoto Tab / Section in the App

Add a new bottom navigation tab or section called **"PaintYourPhoto"** alongside the existing Stencil section.

### 2. PBN Orders List Screen

**Path**: When user navigates to PaintYourPhoto section

**Data source**: `users/{userId}/pbnOrders/` (Firebase Realtime Database)

**Display**:
- List of PBN orders, sorted by `timestamp` (newest first)
- Each card shows:
  - Thumbnail of the original image (`metadata.originalImageUrl`)
  - Product label (e.g. "Medium Canvas 30×40 cm")
  - Material type badge ("Canvas" / "Paper")
  - Number of colours and regions
  - Order date (formatted from `timestamp`)
  - Price paid
- Pull-to-refresh
- Empty state: "No PaintYourPhoto orders yet. Visit fotonix.co.uk to create one!"

### 3. PBN Order Detail Screen

When user taps an order, show the **detail view** with three main viewing modes:

#### 3a. Original Image View
- Display the original uploaded photo from `metadata.originalImageUrl`
- Pinch-to-zoom and pan support
- Header showing order info (product, date, price)

#### 3b. PBN Colour View (Full Colour SVG)
- Load and render the full-colour PBN SVG from `storageUrls` where `type == "svg"`
- This shows the numbered regions filled with their assigned colours
- Pinch-to-zoom and pan support
- The SVG contains all the colour and number data inline

#### 3c. Outline View (Paint Template)
- Load and render the outline SVG from `storageUrls` where `type == "outline-svg"`
- Black outlines with region numbers, no colour fills
- This is what the physical canvas/paper looks like

**View Toggle**: Use a segmented control or tab bar at the top to switch between:
- 📷 Original
- 🎨 Coloured
- ✏️ Outline

### 4. Colour Palette Panel

Below the image view (or as a collapsible bottom sheet), display the **colour palette extracted from the SVG**.

**How to extract the palette**:
The PBN SVG contains `<path>` elements with `fill` attributes (hex colours) and `<text>` elements with region numbers. Parse the SVG to extract:
- All unique fill colours used
- The region numbers associated with each colour
- Build a palette list: `[{ hex: "#a3522b", regionNumbers: [1, 5, 12] }, ...]`

**Display each palette entry as**:
- Large colour swatch (filled square/circle)
- Hex code
- Region numbers using this colour
- **Pipette button** (🎯 icon) — tapping this sets the colour as the **target colour** for the camera mixer

### 5. Pipette → Camera Colour Mixer Flow

This is the core interactive feature. The flow is:

1. **User views the coloured PBN SVG** in the order detail screen
2. **User taps a colour region** in the SVG or taps the **pipette button** (🎯) next to a colour in the palette panel
3. The selected colour becomes the **target colour**
4. App navigates to the **Camera Colour Mixing screen** (reuse the existing camera colour matching code from the Stencil section)
5. The camera screen shows:
   - Live camera feed (full screen)
   - Centre crosshair/circle sampling area
   - **Target colour swatch** and hex code (top overlay)
   - **Detected colour swatch** from camera centre sampling
   - **Match percentage** (using the existing colour similarity algorithm)
   - **Mixing suggestions**: "Add more red", "Add white to lighten", "Perfect match! 🎉"
   - Mark as matched button

#### Reusing Existing Camera Code

The app already has a `PaintMatchingActivity` / camera colour matching screen for the Stencil section. **Reuse the same screen/widget**. The only input it needs is a target colour (RGB/hex). Pass the selected PBN colour as the target.

The existing colour matching algorithm:
```dart
double calculateColorSimilarity(Color target, Color detected) {
  final rDiff = (target.red - detected.red).abs().toDouble();
  final gDiff = (target.green - detected.green).abs().toDouble();
  final bDiff = (target.blue - detected.blue).abs().toDouble();
  
  final distance = sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
  final maxDistance = sqrt(255.0 * 255.0 * 3);
  
  return (1 - (distance / maxDistance)) * 100;
}

String generateSuggestion(Color target, Color detected) {
  final rDiff = target.red - detected.red;
  final gDiff = target.green - detected.green;
  final bDiff = target.blue - detected.blue;
  
  final targetBrightness = (target.red + target.green + target.blue) / 3;
  final detectedBrightness = (detected.red + detected.green + detected.blue) / 3;
  
  if (rDiff.abs() < 10 && gDiff.abs() < 10 && bDiff.abs() < 10) return "Perfect match! 🎉";
  if (detectedBrightness < targetBrightness - 20) return "Add more white to lighten";
  if (detectedBrightness > targetBrightness + 20) return "Add more black to darken";
  if (rDiff > 20) return "Add more red";
  if (rDiff < -20) return "Reduce red (add cyan/blue)";
  if (gDiff > 20) return "Add more green";
  if (gDiff < -20) return "Reduce green (add magenta)";
  if (bDiff > 20) return "Add more blue";
  if (bDiff < -20) return "Reduce blue (add yellow)";
  return "Very close! Minor adjustments needed";
}
```

### 6. Interactive SVG Region Tapping

When the user views the **Coloured PBN SVG** (view mode 3b), they should be able to:

1. **Tap on a coloured region** in the SVG
2. The app identifies which colour was tapped (by sampling the pixel colour at the tap coordinate, or by parsing SVG paths and hit-testing)
3. **Highlight the tapped region** (e.g. add a pulsing border or slight glow)
4. Show a **floating tooltip/popup** with:
   - The colour swatch
   - Hex code
   - Region number(s) using this colour
   - "Mix this colour" button → opens Camera Colour Mixer with this colour as target

**Implementation approach**:
- Render the SVG using `flutter_svg` or convert to a bitmap and use pixel colour sampling on tap
- On tap coordinates `(x, y)`, get the pixel colour from the rendered image
- Match it to the nearest palette colour
- Show the popup/tooltip

---

## Navigation Structure

```
Bottom Nav:
├── Stencils (existing)
├── PaintYourPhoto (NEW)
│   ├── PBN Orders List
│   │   └── PBN Order Detail
│   │       ├── [Toggle] Original / Coloured / Outline
│   │       ├── Colour Palette Panel (bottom sheet)
│   │       │   └── Pipette button per colour → Camera Mixer
│   │       └── Tap region on SVG → Camera Mixer
│   └── Camera Colour Mixer (reused from Stencils)
└── Profile / Settings (existing)
```

---

## UI/UX Design Guidelines

### Colour Scheme
- Primary: Amber/Orange gradient (`#f59e0b` → `#ea580c`) — matches the PBN web section
- Accent: Purple (`#8b5cf6`) for interactive elements
- Success: Green (`#22c55e`) for matched colours
- Background: Light mode — white/slate-50; Dark mode — slate-900/slate-800

### Order Card Design
```
┌──────────────────────────────────────────┐
│  ┌─────┐  Medium Canvas 30×40 cm        │
│  │ IMG │  🎨 18 colours · 142 regions    │
│  │     │  📅 14 Feb 2026                 │
│  └─────┘  Canvas · £30.94               │
└──────────────────────────────────────────┘
```

### Order Detail Screen Layout
```
┌──────────────────────────────────────────┐
│  ← PaintYourPhoto Order                  │
│  ─────────────────────────────────────── │
│  [📷 Original] [🎨 Coloured] [✏️ Outline]│
│  ─────────────────────────────────────── │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │                                  │    │
│  │     Image / SVG Preview          │    │
│  │     (pinch to zoom, pan)         │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ── Colour Palette ──────────────────    │
│  ┌────┐ #a3522b  Regions: 1, 5, 12  🎯  │
│  │████│                                  │
│  └────┘                                  │
│  ┌────┐ #2d5a3e  Regions: 2, 8       🎯  │
│  │████│                                  │
│  └────┘                                  │
│  ┌────┐ #f4e3c1  Regions: 3, 7, 15   🎯  │
│  │████│                                  │
│  └────┘                                  │
│  ... more colours ...                    │
└──────────────────────────────────────────┘
```

### Camera Colour Mixer (reuse existing)
```
┌──────────────────────────────────────────┐
│  ← Mix Colour                            │
│  ─────────────────────────────────────── │
│  Target: ████ #a3522b                    │
│  ─────────────────────────────────────── │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │                                  │    │
│  │      LIVE CAMERA FEED            │    │
│  │                                  │    │
│  │         ┌──────┐                 │    │
│  │         │  ⊕   │  ← sampling    │    │
│  │         └──────┘    area         │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Detected: ████  RGB(250, 120, 10)       │
│  Match: 85% ⭐⭐⭐⭐                      │
│                                          │
│  💡 "Add more white to lighten"          │
│                                          │
│  [✓ Mark as Matched]    [✕ Cancel]       │
└──────────────────────────────────────────┘
```

---

## Technical Implementation Notes

### SVG Rendering
- Use `flutter_svg` package for rendering SVGs inline
- For interactive tapping, consider rendering the SVG to a `CustomPainter` canvas or using `RepaintBoundary` + pixel sampling
- The PBN SVGs are self-contained with inline styles — no external assets needed

### SVG Palette Extraction

**IMPORTANT**: The palette is now pre-computed and stored in the order as `paletteData`. You do NOT need to parse the SVG to extract colours. Each entry in `paletteData` contains:
- `number` — the colour number shown on the SVG (e.g. 24)
- `hex` — the hex colour code (e.g. "#d4a574")
- `name` — the colour name (e.g. "Peach")

The `number` field matches exactly what's printed inside regions on the SVG/canvas. If region 24 is a cheek area, the customer looks up number 24 in the palette to find the colour.

The PBN SVG files have this structure:
```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
  <!-- Coloured regions -->
  <path d="M..." fill="#a3522b" stroke="#333" stroke-width="0.5"/>
  <path d="M..." fill="#2d5a3e" stroke="#333" stroke-width="0.5"/>
  <!-- Region number labels -->
  <text x="100" y="200" font-size="8" fill="#333" text-anchor="middle">1</text>
  <text x="300" y="400" font-size="8" fill="#333" text-anchor="middle">2</text>
</svg>
```

To extract the palette:
1. **Preferred**: Use the `paletteData` array from the Firebase order — it already has `number`, `hex`, and `name` for each colour. No SVG parsing needed.
2. **Fallback** (if `paletteData` is missing on older orders): Parse the SVG XML, find all `<path>` elements with `fill` attributes, collect unique fill colours, match to nearby `<text>` elements for region numbers.

### Firebase Integration
```dart
// Fetch PBN orders
final userId = FirebaseAuth.instance.currentUser?.uid;
final ordersRef = FirebaseDatabase.instance.ref('users/$userId/pbnOrders');
final snapshot = await ordersRef.orderByChild('timestamp').get();

if (snapshot.exists) {
  final orders = <PbnOrder>[];
  for (final child in snapshot.children) {
    orders.add(PbnOrder.fromJson(child.value as Map));
  }
  orders.sort((a, b) => b.timestamp.compareTo(a.timestamp)); // newest first
}
```

### Image Loading
```dart
// Load original image from Firebase Storage URL
Image.network(
  order.metadata.originalImageUrl,
  fit: BoxFit.contain,
  loadingBuilder: (context, child, progress) {
    if (progress == null) return child;
    return CircularProgressIndicator();
  },
)
```

### Passing Target Colour to Camera Mixer
```dart
// When user taps pipette button for a colour
void onPipetteTap(PbnPaletteColor color) {
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => CameraColorMixerScreen(
        targetColor: Color(int.parse(color.hex.replaceFirst('#', '0xFF'))),
        targetHex: color.hex,
        label: 'Region ${color.regionNumbers.join(", ")}',
      ),
    ),
  );
}
```

---

## Data Models

```dart
class PbnOrder {
  final String orderId;
  final int timestamp;
  final String productKey;
  final String productLabel;
  final String materialType;
  final String selectedSize;
  final PbnPricing pricing;
  final List<PbnStorageUrl> storageUrls;
  final PbnMetadata metadata;
  final List<PbnPaletteColor> paletteData;  // pre-computed palette from order
  
  // Factory constructor from Firebase JSON
}

class PbnPricing {
  final String subtotal;
  final String deliveryFee;
  final String total;
}

class PbnStorageUrl {
  final String type;  // 'svg', 'hd-png', 'outline-svg', 'palette-svg'
  final String url;
}

class PbnMetadata {
  final int numColors;
  final int detailLevel;
  final int regionCount;
  final int analysisWidth;
  final int analysisHeight;
  final String originalImageUrl;
}

class PbnPaletteColor {
  final int number;     // matches the number on the SVG/canvas (e.g. 24)
  final String hex;     // e.g. "#d4a574"
  final String name;    // e.g. "Peach"
}
```

---

## Summary of Work

1. **Add "PaintYourPhoto" tab** to bottom navigation (alongside existing Stencils tab)
2. **PBN Orders List screen** — fetch from `users/{uid}/pbnOrders/`, show cards with thumbnails
3. **PBN Order Detail screen** — three-way toggle (Original / Coloured / Outline), pinch-zoom
4. **Colour Palette panel** — extracted from SVG, with pipette buttons per colour
5. **Interactive SVG tapping** — tap a region → identify colour → show popup → option to mix
6. **Camera Colour Mixer** — **reuse the existing camera colour matching screen** from the Stencil section, just pass the target colour (hex/RGB) from the selected PBN region
7. The camera screen already handles: live feed, centre sampling, colour comparison, match %, mixing suggestions, mark-as-matched

**DO NOT** rebuild the camera colour matching from scratch — import and reuse the existing widget/screen. The only new parameter it needs is the target `Color` object.
