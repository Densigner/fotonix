# Stencil Color Guide Android App - Development Instructions

## Overview
You are developing an Android companion app for the Fotonix Stencil Generator system. This app allows users to view which paint colors to apply to each stencil layer when creating their artwork.

## System Architecture

### Web Application (Already Built)
The web application (`StencilGenerator.js`) processes images into multiple stencil layers and allows users to:
1. Upload an image
2. Generate N stencil layers (configurable, default 15)
3. **Automatically extract the actual paint colors from the original image** for each layer
4. Purchase the stencils via PayPal
5. Save everything to Firebase (including extracted colors)

### Firebase Data Structure

#### Location: `users/{userId}/stencilOrders/{orderId}`

```json
{
  "orderId": "PAYPAL_ORDER_ID",
  "timestamp": 1732636800000,
  "paypalStatus": "COMPLETED",
  "numStencils": 15,
  "pricing": {
    "pricePerStencil": 3.00,
    "subtotal": "45.00",
    "deliveryFee": "0.00",
    "total": "45.00"
  },
  "storageUrls": [
    {
      "layerIndex": 0,
      "fileName": "stencil-layer-1-1732636800000.png",
      "url": "https://firebasestorage.googleapis.com/...",
      "threshold": "0 - 17"
    },
    {
      "layerIndex": 1,
      "fileName": "stencil-layer-2-1732636800000.png",
      "url": "https://firebasestorage.googleapis.com/...",
      "threshold": "17 - 34"
    }
    // ... more layers
  ],
  "metadata": {
    "layerMode": "discrete",
    "thresholdMethod": "uniform",
    "originalImageName": "photo.jpg"
  },
  "paintingGuide": {
    "layerColors": [
      {
        "layerIndex": 0,
        "color": {
          "hex": "#000000",
          "rgb": {
            "r": 0,
            "g": 0,
            "b": 0
          },
          "name": "Layer 1 Gray"
        },
        "paintOrder": 1,
        "threshold": "0 - 17"
      },
      {
        "layerIndex": 1,
        "color": {
          "hex": "#111111",
          "rgb": {
            "r": 17,
            "g": 17,
            "b": 17
          },
          "name": "Layer 2 Gray"
        },
        "paintOrder": 2,
        "threshold": "17 - 34"
      }
      // ... more colors for each layer
    ],
    "totalLayers": 15,
    "instructions": "Use the Android companion app to view color placement guide"
  }
}
```

## How the Stencil System Works

### Layer Generation
1. **Image Upload**: User uploads a photo/image
2. **Grayscale Conversion**: Image converted to grayscale (0-255 brightness)
3. **Quantization**: Brightness range split into N bands (layers)
   - Example with 15 layers: 0-17, 17-34, 34-51, ..., 238-255
4. **Binary Masks**: Each layer becomes a stencil:
   - **Black areas** = Cut-out (spray/paint goes through)
   - **White areas** = Material (blocked, no paint)

### Layer Modes
- **Discrete**: Each layer only contains pixels in that brightness band
  - Layer 1: pixels 0-17 brightness
  - Layer 2: pixels 17-34 brightness
  - Layers don't overlap
- **Cumulative**: Each layer includes all darker pixels
  - Layer 1: pixels ≤17
  - Layer 2: pixels ≤34
  - Layers build on each other

### Color Assignment
Colors are **automatically extracted from the original image**, not manually assigned:
1. **Color Extraction Algorithm**: For each layer (brightness band), the system:
   - Samples all pixels in the original image that fall within that brightness range
   - Calculates the average RGB color of those pixels
   - Converts to hex format
   - Names the color based on dominant channel (Red, Blue, Green, Orange, Yellow, Purple, Gray)
2. **Result**: Each layer gets the **actual color from the original image** in that brightness range
3. **Use Case**: When painting, users replicate the original image's colors by painting each numbered stencil with its extracted color
4. **Paint Order**: Layers numbered 1-N indicating painting sequence (1 = darkest/first)

**Example:**
- Original image has a sunset with dark blue sky (brightness 0-50)
- Layer 1 (brightness 0-17): Extracts average color → Dark Blue `#1a2332`
- Layer 2 (brightness 17-34): Extracts average color → Blue-Purple `#3d4477`
- Layer 3 (brightness 34-51): Extracts average color → Orange `#ff7744`
- And so on...

### Physical Workflow
1. User uploads an image to the web app
2. System generates stencil layers AND extracts the actual colors from the image
3. User purchases stencils via PayPal
4. User receives physical stencils in mail (each numbered: Layer 1, Layer 2, etc.)
5. User opens Android app to see the color guide
6. For each numbered stencil, the app shows the exact color to paint (extracted from original image)
7. User paints each layer in order with its corresponding color
8. Final result: Multi-layered painting that **recreates the original image**

## Android App Requirements

### Core Features

#### 1. Authentication
- Firebase Authentication integration
- Login with email/password (same as web app)
- Access user's orders via `users/{userId}/stencilOrders/`

#### 2. Order List View
- Display all purchased stencil orders
- Show:
  - Original image thumbnail (from first storageUrl)
  - Order date (timestamp)
  - Number of layers
  - Order status
- Sort by date (newest first)
- Pull to refresh

#### 3. Order Detail View
When user taps an order, show:
- **Header**: Original image preview
- **Order Info**:
  - Order ID
  - Purchase date
  - Number of layers
  - Layer mode (discrete/cumulative)
- **Color Guide Grid**:
  - Visual grid showing all layers
  - Each cell shows:
    - Layer number (#1, #2, etc.)
    - Color swatch (large)
    - Hex color code
    - RGB values
    - Paint order indicator
- **Action Buttons**:
  - View full layer image (opens in gallery)
  - Share color guide (screenshot)

#### 4. Layer Detail View
When user taps a specific layer:
- **Full-screen stencil image** (from storageUrls)
- **Overlay with color info**:
  - Large color swatch
  - Hex code (copyable)
  - RGB values
  - Paint order: "Paint this 3rd"
  - Threshold range
- **Navigation**: Swipe left/right between layers
- **Zoom**: Pinch to zoom on stencil image

#### 5. AR Preview (Future Enhancement)
- Use device camera to preview color placement
- Overlay colored layers on real surface
- Help visualize final result before painting

### UI/UX Design Guidelines

#### Color Scheme
Match web app:
- Primary: Purple (#A855F7) to Pink (#EC4899) gradients
- Accent: Orange (#F97316) for color section
- Success: Green (#22C55E)
- Background: Light/Dark mode support

#### Layout
- Material Design 3 principles
- Bottom navigation:
  - Orders
  - My Projects (saved guides)
  - Settings
- Floating action button for quick camera access (future AR)

#### Typography
- Headers: Bold, gradient text
- Body: Clear, readable
- Color codes: Monospace font

### Technical Stack Recommendations

#### Framework Options
1. **Kotlin + Jetpack Compose** (Modern, recommended)
   - Clean UI composition
   - Easy state management
   - Material Design 3 built-in

2. **Flutter** (Cross-platform alternative)
   - Single codebase for iOS too
   - Rich UI components
   - Good Firebase support

#### Key Libraries
- **Firebase SDK**:
  - Firebase Auth
  - Firebase Realtime Database
  - Firebase Storage (for images)
- **Image Loading**: Coil or Glide
- **JSON parsing**: kotlinx.serialization or Gson
- **Async**: Coroutines (Kotlin) or async/await (Dart)

### Data Flow

#### Fetching Orders
```kotlin
// Example Kotlin code structure
val database = FirebaseDatabase.getInstance()
val userId = FirebaseAuth.getInstance().currentUser?.uid

database.getReference("users/$userId/stencilOrders")
    .addValueEventListener(object : ValueEventListener {
        override fun onDataChange(snapshot: DataSnapshot) {
            val orders = snapshot.children.mapNotNull { 
                it.getValue(StencilOrder::class.java)
            }
            // Update UI with orders
        }
    })
```

#### Data Models
```kotlin
data class StencilOrder(
    val orderId: String = "",
    val timestamp: Long = 0,
    val paypalStatus: String = "",
    val numStencils: Int = 0,
    val pricing: Pricing = Pricing(),
    val storageUrls: List<StorageUrl> = emptyList(),
    val metadata: Metadata = Metadata(),
    val paintingGuide: PaintingGuide = PaintingGuide()
)

data class PaintingGuide(
    val layerColors: List<LayerColor> = emptyList(),
    val totalLayers: Int = 0,
    val instructions: String = ""
)

data class LayerColor(
    val layerIndex: Int = 0,
    val color: ColorInfo = ColorInfo(),
    val paintOrder: Int = 0,
    val threshold: String = ""
)

data class ColorInfo(
    val hex: String = "",
    val rgb: RGBColor = RGBColor(),
    val name: String = ""
)

data class RGBColor(
    val r: Int = 0,
    val g: Int = 0,
    val b: Int = 0
)

data class StorageUrl(
    val layerIndex: Int = 0,
    val fileName: String = "",
    val url: String = "",
    val threshold: String = ""
)

data class Metadata(
    val layerMode: String = "",
    val thresholdMethod: String = "",
    val originalImageName: String = ""
)

data class Pricing(
    val pricePerStencil: Double = 0.0,
    val subtotal: String = "",
    val deliveryFee: String = "",
    val total: String = ""
)
```

### Key User Flows

#### Flow 1: View Color Guide
1. User opens app → Login
2. See list of purchased stencil orders
3. Tap order → See color guide grid
4. View all layers with their colors at once
5. Reference while painting physical stencils

#### Flow 2: Check Specific Layer
1. In color guide, tap Layer #3
2. See full stencil image
3. See large color swatch: "#FF6600"
4. Note: "Paint this 3rd"
5. Return to guide for next layer

#### Flow 3: Share Guide
1. Open color guide
2. Tap share button
3. Generate screenshot of color grid
4. Share via messaging/email
5. Friend can reference same colors

### Error Handling
- **No internet**: Show cached orders, indicate offline mode
- **Image load fail**: Show placeholder, retry button
- **No orders**: Empty state with instructions to purchase on web
- **Auth error**: Clear error messages, re-login flow

### Performance Considerations
- **Image caching**: Cache downloaded stencil images locally
- **Lazy loading**: Load images as needed, not all at once
- **Pagination**: If user has many orders, paginate list
- **Offline support**: Cache critical data for offline viewing

### Testing Checklist
- [ ] Login/logout flow
- [ ] Fetch and display orders
- [ ] Display color guide correctly
- [ ] Colors match web app assignments
- [ ] Image loading and caching
- [ ] Navigation between layers
- [ ] Color code copying
- [ ] Dark/light mode switching
- [ ] Offline behavior
- [ ] Different screen sizes

### Future Enhancements
1. **AR Mode**: Camera overlay showing where colors go
2. **Progress Tracking**: Mark layers as "painted"
3. **Notes**: Add personal notes per layer
4. **Timer**: Track painting time per layer
5. **Gallery**: Save photos of finished artwork
6. **Community**: Share completed projects
7. **Color Mixer**: Suggest paint mixing ratios to achieve colors

### Firebase Configuration
Use the same Firebase project as web app:
```
Project ID: fotonix-97544
Database URL: https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app
Storage Bucket: fotonix-97544.firebasestorage.app
```

Download `google-services.json` from Firebase Console for Android integration.

### API Endpoints (if needed)
Web backend runs on `http://localhost:4000` (dev) or production URL:
- No specific endpoints needed - app reads directly from Firebase RTDB
- All data accessible via Firebase SDK

### Security Rules (Firebase RTDB)
Ensure users can only read their own orders:
```json
{
  "rules": {
    "users": {
      "$userId": {
        "stencilOrders": {
          ".read": "$userId === auth.uid",
          ".write": "false"
        }
      }
    }
  }
}
```

## Summary for Android Developer

You're building an app that:
1. **Authenticates** users (Firebase Auth)
2. **Fetches** their purchased stencil orders from Firebase RTDB
3. **Displays** color guides showing which paint color to use for each numbered stencil layer
   - **IMPORTANT**: These colors are automatically extracted FROM THE ORIGINAL IMAGE, not user-selected
   - Each color represents the actual average color of pixels in that brightness range from the source image
4. **Shows** the actual stencil images alongside color information
5. **Helps** users recreate the original image by painting each stencil layer with its extracted color

The web app handles:
- Image processing & layer generation
- **Automatic color extraction from the original image**
- Payment processing
- Firebase storage

Your app is the **painting companion** that shows users which real colors from their original image to use for each physical stencil, allowing them to recreate the image through layered painting.

Key data is in `users/{userId}/stencilOrders/{orderId}/paintingGuide/layerColors[]` - each array item contains the **extracted color from the original image** (hex, RGB) for that layer number and painting order.

Good luck! 🎨
