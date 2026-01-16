# Stencil Painting Guide - Mobile App Specification (Android/iOS)

## 📱 App Overview

**Purpose**: Companion app for customers who purchased stencil layers, providing layer downloads, color guides, and real-time camera-based paint color matching.

**Target Platforms**: Android (Kotlin/Java) and iOS (Swift)

**User Flow**: Login → View Orders → Select Order → Download Layers → View Color Guide → Mix Paint with Camera Assistance

---

## 🎯 Core Features

### 1. **User Authentication**
- Firebase Authentication integration
- Login with same credentials as web app
- Secure access to user's stencil orders

### 2. **Order Management**
- View all purchased stencil orders
- Display order metadata: date, number of layers, price
- Download PNG layer images to device storage

### 3. **Color Guide System**
- Visual display of extracted colors for each layer
- Paint order sequence (lightest to darkest)
- Color details: RGB values, hex codes, color names

### 4. **Real-Time Camera Color Matching**
- Live camera feed to view mixed paint
- AI-powered color analysis and comparison
- Real-time suggestions: "Add more white", "Add red", "Perfect match!"
- Visual feedback with percentage accuracy

### 5. **Layer-by-Layer Painting Workflow**
- Step-by-step guidance through each stencil layer
- Mark layers as complete
- Progress tracking

---

## 🏗️ Technical Architecture

### Technology Stack

#### Android
- **Language**: Kotlin (preferred) or Java
- **UI Framework**: Jetpack Compose or XML layouts
- **Camera**: CameraX API
- **Image Processing**: OpenCV for Android
- **Networking**: Retrofit or OkHttp
- **Database**: Room (for offline caching)
- **Firebase SDK**: 
  - Firebase Auth
  - Firebase Realtime Database
  - Firebase Storage

#### iOS
- **Language**: Swift
- **UI Framework**: SwiftUI or UIKit
- **Camera**: AVFoundation
- **Image Processing**: Core Image or Vision framework
- **Networking**: URLSession or Alamofire
- **Database**: Core Data or Realm
- **Firebase SDK**:
  - Firebase Auth
  - Firebase Realtime Database
  - Firebase Storage

---

## 📊 Firebase Data Structure

### ⚠️ IMPORTANT: Orders vs Downloads

| Path | Type | Description |
|------|------|-------------|
| `/users/{userId}/stencilOrders/` | **ORDERS** | Paid purchases with shipping, fulfillment tracking |
| `/users/{userId}/stencilDownloads/` | **DOWNLOADS** | Free SVG file downloads for personal use |

**Key Differences:**
- **Orders** = Customer paid → requires fulfillment → has shipping address, payment status
- **Downloads** = User downloaded SVG for free → no fulfillment → just file access

---

### Customer Orders Path (Purchased Orders - REQUIRES FULFILLMENT)
```
/users/{userId}/stencilOrders/{orderId}
```

### Stencil Downloads Path (Downloaded SVGs - NO FULFILLMENT)
```
/users/{userId}/stencilDownloads/{downloadId}
```

### Downloaded Stencil JSON Structure
```json
{
  "id": "download_1705234567890_abc123",
  "fileName": "photo_am-halftone.svg",
  "svgUrl": "https://firebasestorage.googleapis.com/...",
  "thumbnailUrl": "https://firebasestorage.googleapis.com/...",
  "originalImageName": "photo.jpg",
  "type": "am-halftone",
  "isDownload": true,
  "isPurchasedOrder": false,
  "createdAt": 1705234567890,
  "layerIndex": 0,
  "threshold": [0, 17],
  "settings": {
    "spacingMm": 1.5,
    "maxDotMm": 1.2,
    "gamma": 1.0,
    "contrast": 1.2,
    "blurRadiusPx": 1.5,
    "lightCutoff": 0.88,
    "darkCutoff": 0.05,
    "minWebMm": 0.4,
    "rotationDeg": 0,
    "invert": false,
    "minCutDiameterMm": 0.8
  }
}
```

### Order JSON Structure (Paid Purchase)
```json
{
  "orderId": "ABC123XYZ",
  "timestamp": 1732636800000,
  "paypalStatus": "COMPLETED",
  "numStencils": 15,
  "pricing": {
    "total": "45.00"
  },
  "storageUrls": [
    {
      "layerIndex": 0,
      "pngFileName": "stencil-layer-1-1234567890.png",
      "pngUrl": "https://firebasestorage.googleapis.com/...",
      "threshold": [0, 17]
    },
    {
      "layerIndex": 1,
      "pngFileName": "stencil-layer-2-1234567890.png",
      "pngUrl": "https://firebasestorage.googleapis.com/...",
      "threshold": [17, 34]
    }
  ],
  "metadata": {
    "layerMode": "discrete",
    "stencilMode": "island-bridge",
    "originalImageName": "sunset.jpg"
  },
  "paintingGuide": {
    "layerColors": [
      {
        "layerIndex": 0,
        "paintOrder": 1,
        "color": {
          "hex": "#1a1a2e",
          "rgb": { "r": 26, "g": 26, "b": 46 },
          "name": "Dark Navy"
        },
        "threshold": [0, 17]
      },
      {
        "layerIndex": 1,
        "paintOrder": 2,
        "color": {
          "hex": "#ff6b6b",
          "rgb": { "r": 255, "g": 107, "b": 107 },
          "name": "Coral"
        },
        "threshold": [17, 34]
      }
    ],
    "totalLayers": 15,
    "instructions": "Use this app to view color placement guide"
  }
}
```

---

## 🎨 Screen Designs & Features

### Screen 1: Login Screen
**Purpose**: Authenticate user with Firebase

**UI Elements**:
- Email input field
- Password input field
- "Login" button
- "Forgot Password" link
- Fotonix logo

**Implementation**:
```kotlin
// Android (Kotlin)
FirebaseAuth.getInstance().signInWithEmailAndPassword(email, password)
    .addOnCompleteListener { task ->
        if (task.isSuccessful) {
            navigateToOrdersList()
        } else {
            showError(task.exception?.message)
        }
    }
```

```swift
// iOS (Swift)
Auth.auth().signIn(withEmail: email, password: password) { authResult, error in
    if let error = error {
        showError(error.localizedDescription)
    } else {
        navigateToOrdersList()
    }
}
```

---

### Screen 2: Orders & Downloads
**Purpose**: Display purchased orders AND downloaded stencils

**Tab Structure**:
- **Tab 1: Orders** - Purchased stencil orders with payment
- **Tab 2: Downloads** - Free downloaded SVG stencils

#### Orders Tab
**UI Elements**:
- List/RecyclerView of order cards
- Each card shows:
  - Order ID (shortened)
  - Date of purchase
  - Number of layers
  - Total price
  - Thumbnail preview (if available)
  - "View Details" button

#### Downloads Tab (SVG Downloads - NOT Orders)
**UI Elements**:
- List/RecyclerView of downloaded stencil cards
- **Header**: "My Downloads" (NOT "My Orders")
- Each card shows:
  - Original image thumbnail
  - File name
  - Date downloaded
  - Stencil type (AM Halftone, Layer Stencil, etc.)
  - "Download SVG" button
  - "Delete" button
- **Note**: Show badge/label "Downloaded" to distinguish from paid orders

**Implementation (Downloads - from stencilDownloads)**:
```kotlin
// Android (Kotlin) - Fetch downloaded stencils (NOT orders)
// Path: /users/{userId}/stencilDownloads/ 
val downloadsRef = database.getReference("users/$userId/stencilDownloads")

downloadsRef.addValueEventListener(object : ValueEventListener {
    override fun onDataChange(snapshot: DataSnapshot) {
        val downloads = mutableListOf<StencilDownload>()
        snapshot.children.forEach { child ->
            val download = child.getValue(StencilDownload::class.java)
            // Verify it's a download, not an order
            if (download?.isDownload == true) {
                downloads.add(download)
            }
        }
        downloadsAdapter.submitList(downloads.sortedByDescending { it.createdAt })
    }
    
    override fun onCancelled(error: DatabaseError) {
        showError(error.message)
    }
})
```

```swift
// iOS (Swift) - Fetch downloaded stencils (NOT orders)
// Path: /users/{userId}/stencilDownloads/
ref.child("users").child(userId).child("stencilDownloads").observe(.value) { snapshot in
    var downloads: [StencilDownload] = []
    for child in snapshot.children {
        if let childSnapshot = child as? DataSnapshot,
           let download = StencilDownload(snapshot: childSnapshot),
           download.isDownload == true {
            downloads.append(download)
        }
    }
    self.downloads = downloads.sorted { $0.createdAt > $1.createdAt }
    self.collectionView.reloadData()
}
```

**Implementation (Orders)**:
```kotlin
// Android (Kotlin)
val database = FirebaseDatabase.getInstance()
val userId = FirebaseAuth.getInstance().currentUser?.uid
val ordersRef = database.getReference("users/$userId/stencilOrders")

ordersRef.addValueEventListener(object : ValueEventListener {
    override fun onDataChange(snapshot: DataSnapshot) {
        val orders = mutableListOf<Order>()
        snapshot.children.forEach { child ->
            val order = child.getValue(Order::class.java)
            order?.let { orders.add(it) }
        }
        ordersAdapter.submitList(orders.sortedByDescending { it.timestamp })
    }
    
    override fun onCancelled(error: DatabaseError) {
        showError(error.message)
    }
})
```

```swift
// iOS (Swift)
let ref = Database.database().reference()
let userId = Auth.auth().currentUser?.uid ?? ""
ref.child("users").child(userId).child("stencilOrders").observe(.value) { snapshot in
    var orders: [Order] = []
    for child in snapshot.children {
        if let childSnapshot = child as? DataSnapshot,
           let order = Order(snapshot: childSnapshot) {
            orders.append(order)
        }
    }
    self.orders = orders.sorted { $0.timestamp > $1.timestamp }
    self.tableView.reloadData()
}
```

---

### Screen 3: Order Details
**Purpose**: Show full order information and color guide

**UI Elements**:
- Order header:
  - Order ID
  - Date
  - Status badge
- Layer count and pricing
- "Download All Layers" button
- Color guide section:
  - Scrollable list of colors
  - Each color shows:
    - Layer number
    - Paint order (1st, 2nd, 3rd...)
    - Color swatch
    - Color name
    - RGB values
    - Hex code
    - "Match Paint" button
- Individual layer cards:
  - Layer number
  - Thumbnail preview
  - "Download" button
  - "View Full Size" button

**Implementation**:
```kotlin
// Android (Kotlin)
fun downloadLayer(layer: StorageUrl) {
    val storage = FirebaseStorage.getInstance()
    val imageRef = storage.getReferenceFromUrl(layer.pngUrl)
    
    // Create local file
    val localFile = File(
        context.getExternalFilesDir(Environment.DIRECTORY_PICTURES),
        layer.pngFileName
    )
    
    imageRef.getFile(localFile)
        .addOnSuccessListener {
            Toast.makeText(context, "Layer ${layer.layerIndex + 1} downloaded", Toast.LENGTH_SHORT).show()
            // Add to gallery
            MediaScannerConnection.scanFile(context, arrayOf(localFile.path), null, null)
        }
        .addOnFailureListener { exception ->
            showError("Download failed: ${exception.message}")
        }
}
```

```swift
// iOS (Swift)
func downloadLayer(layer: StorageUrl) {
    let storage = Storage.storage()
    let imageRef = storage.reference(forURL: layer.pngUrl)
    
    // Download to temporary directory
    let localURL = FileManager.default.temporaryDirectory
        .appendingPathComponent(layer.pngFileName)
    
    imageRef.write(toFile: localURL) { url, error in
        if let error = error {
            showError("Download failed: \(error.localizedDescription)")
        } else {
            // Save to Photos
            if let image = UIImage(contentsOfFile: localURL.path) {
                UIImageWriteToSavedPhotosAlbum(image, self, #selector(image(_:didFinishSavingWithError:contextInfo:)), nil)
            }
        }
    }
}
```

---

### Screen 4: Paint Mixing Assistant (Camera)
**Purpose**: Real-time color matching using device camera

**UI Layout**:
```
┌─────────────────────────────────┐
│  Camera Preview (Full Screen)   │
│                                  │
│  ┌─────────────────────────────┐│
│  │   Target Crosshair/Circle   ││ <- Center focus area
│  └─────────────────────────────┘│
│                                  │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Target Color Info (Overlay)     │
│ ┌───┐ Layer 5: Sunset Orange    │
│ │███│ RGB: (255, 140, 0)         │
│ └───┘ Hex: #FF8C00              │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Current Mix (Detected Color)    │
│ ┌───┐ RGB: (250, 120, 10)       │
│ │███│ Match: 85% ⭐⭐⭐⭐        │
│ └───┘                            │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 💡 Suggestion:                   │
│ "Add more white to lighten"     │
│ "Very close! Add tiny bit of red"│
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  [✓ Mark as Matched] [❌ Cancel] │
└─────────────────────────────────┘
```

**Key Features**:
1. **Live Camera Feed**: Real-time preview
2. **Center Sampling**: Extract color from center circle (helps user focus paint sample)
3. **Color Comparison**: Calculate similarity between target and detected color
4. **Smart Suggestions**: AI-driven mixing advice
5. **Match Threshold**: 90%+ accuracy = "Perfect Match!"

**Color Comparison Algorithm**:
```kotlin
// Android (Kotlin)
fun calculateColorSimilarity(target: Color, detected: Color): Float {
    val rDiff = abs(target.red - detected.red)
    val gDiff = abs(target.green - detected.green)
    val bDiff = abs(target.blue - detected.blue)
    
    // Euclidean distance in RGB space
    val distance = sqrt((rDiff * rDiff + gDiff * gDiff + bDiff * bDiff).toDouble())
    val maxDistance = sqrt(255.0 * 255.0 * 3) // Max possible distance
    
    // Convert to percentage (100% = perfect match)
    val similarity = (1 - (distance / maxDistance)) * 100
    return similarity.toFloat()
}

fun generateSuggestion(target: Color, detected: Color): String {
    val rDiff = target.red - detected.red
    val gDiff = target.green - detected.green
    val bDiff = target.blue - detected.blue
    
    // Brightness comparison
    val targetBrightness = (target.red + target.green + target.blue) / 3
    val detectedBrightness = (detected.red + detected.green + detected.blue) / 3
    
    return when {
        abs(rDiff) < 10 && abs(gDiff) < 10 && abs(bDiff) < 10 -> "Perfect match! 🎉"
        detectedBrightness < targetBrightness - 20 -> "Add more white to lighten"
        detectedBrightness > targetBrightness + 20 -> "Add more black to darken"
        rDiff > 20 -> "Add more red"
        rDiff < -20 -> "Reduce red (add cyan/blue)"
        gDiff > 20 -> "Add more green"
        gDiff < -20 -> "Reduce green (add magenta)"
        bDiff > 20 -> "Add more blue"
        bDiff < -20 -> "Reduce blue (add yellow)"
        else -> "Very close! Minor adjustments needed"
    }
}
```

```swift
// iOS (Swift)
func calculateColorSimilarity(target: UIColor, detected: UIColor) -> Float {
    var tr: CGFloat = 0, tg: CGFloat = 0, tb: CGFloat = 0, ta: CGFloat = 0
    var dr: CGFloat = 0, dg: CGFloat = 0, db: CGFloat = 0, da: CGFloat = 0
    
    target.getRed(&tr, green: &tg, blue: &tb, alpha: &ta)
    detected.getRed(&dr, green: &dg, blue: &db, alpha: &da)
    
    let rDiff = abs(tr - dr) * 255
    let gDiff = abs(tg - dg) * 255
    let bDiff = abs(tb - db) * 255
    
    let distance = sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff)
    let maxDistance = sqrt(255.0 * 255.0 * 3.0)
    
    let similarity = (1 - (distance / maxDistance)) * 100
    return Float(similarity)
}

func generateSuggestion(target: UIColor, detected: UIColor) -> String {
    var tr: CGFloat = 0, tg: CGFloat = 0, tb: CGFloat = 0, ta: CGFloat = 0
    var dr: CGFloat = 0, dg: CGFloat = 0, db: CGFloat = 0, da: CGFloat = 0
    
    target.getRed(&tr, green: &tg, blue: &tb, alpha: &ta)
    detected.getRed(&dr, green: &dg, blue: &db, alpha: &da)
    
    let rDiff = (tr - dr) * 255
    let gDiff = (tg - dg) * 255
    let bDiff = (tb - db) * 255
    
    let targetBrightness = (tr + tg + tb) / 3 * 255
    let detectedBrightness = (dr + dg + db) / 3 * 255
    
    switch true {
    case abs(rDiff) < 10 && abs(gDiff) < 10 && abs(bDiff) < 10:
        return "Perfect match! 🎉"
    case detectedBrightness < targetBrightness - 20:
        return "Add more white to lighten"
    case detectedBrightness > targetBrightness + 20:
        return "Add more black to darken"
    case rDiff > 20:
        return "Add more red"
    case rDiff < -20:
        return "Reduce red (add cyan/blue)"
    case gDiff > 20:
        return "Add more green"
    case gDiff < -20:
        return "Reduce green (add magenta)"
    case bDiff > 20:
        return "Add more blue"
    case bDiff < -20:
        return "Reduce blue (add yellow)"
    default:
        return "Very close! Minor adjustments needed"
    }
}
```

**Camera Implementation**:

```kotlin
// Android (Kotlin) - Using CameraX
class PaintMatchingActivity : AppCompatActivity() {
    private lateinit var cameraExecutor: ExecutorService
    private lateinit var imageAnalysis: ImageAnalysis
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        cameraExecutor = Executors.newSingleThreadExecutor()
        startCamera()
    }
    
    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(viewBinding.cameraPreview.surfaceProvider)
            }
            
            imageAnalysis = ImageAnalysis.Builder()
                .setTargetResolution(Size(1280, 720))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor, ColorAnalyzer { detectedColor ->
                        runOnUiThread {
                            updateUI(detectedColor)
                        }
                    })
                }
            
            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            
            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageAnalysis
                )
            } catch (e: Exception) {
                Log.e("CameraX", "Binding failed", e)
            }
        }, ContextCompat.getMainExecutor(this))
    }
    
    private class ColorAnalyzer(
        private val onColorDetected: (Color) -> Unit
    ) : ImageAnalysis.Analyzer {
        override fun analyze(image: ImageProxy) {
            val buffer = image.planes[0].buffer
            val data = buffer.toByteArray()
            val width = image.width
            val height = image.height
            
            // Sample center 50x50 pixels
            val centerX = width / 2
            val centerY = height / 2
            val sampleSize = 50
            
            var rSum = 0
            var gSum = 0
            var bSum = 0
            var count = 0
            
            for (y in (centerY - sampleSize/2) until (centerY + sampleSize/2)) {
                for (x in (centerX - sampleSize/2) until (centerX + sampleSize/2)) {
                    val index = y * width + x
                    if (index in data.indices) {
                        // YUV to RGB conversion
                        val yValue = data[index].toInt() and 0xFF
                        rSum += yValue
                        gSum += yValue
                        bSum += yValue
                        count++
                    }
                }
            }
            
            if (count > 0) {
                val avgR = rSum / count
                val avgG = gSum / count
                val avgB = bSum / count
                onColorDetected(Color.valueOf(avgR / 255f, avgG / 255f, avgB / 255f))
            }
            
            image.close()
        }
    }
}
```

```swift
// iOS (Swift) - Using AVFoundation
class PaintMatchingViewController: UIViewController, AVCaptureVideoDataOutputSampleBufferDelegate {
    var captureSession: AVCaptureSession!
    var previewLayer: AVCaptureVideoPreviewLayer!
    var targetColor: UIColor!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupCamera()
    }
    
    func setupCamera() {
        captureSession = AVCaptureSession()
        captureSession.sessionPreset = .high
        
        guard let captureDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: captureDevice) else {
            return
        }
        
        captureSession.addInput(input)
        
        let videoOutput = AVCaptureVideoDataOutput()
        videoOutput.setSampleBufferDelegate(self, queue: DispatchQueue(label: "videoQueue"))
        captureSession.addOutput(videoOutput)
        
        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.frame = view.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        
        captureSession.startRunning()
    }
    
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
        
        let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer)
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
        
        // Sample center 50x50 pixels
        let centerX = width / 2
        let centerY = height / 2
        let sampleSize = 50
        
        var rSum: Int = 0
        var gSum: Int = 0
        var bSum: Int = 0
        var count = 0
        
        for y in (centerY - sampleSize/2)..<(centerY + sampleSize/2) {
            for x in (centerX - sampleSize/2)..<(centerX + sampleSize/2) {
                let offset = y * bytesPerRow + x * 4
                if let base = baseAddress {
                    let pixel = base.advanced(by: offset).assumingMemoryBound(to: UInt8.self)
                    rSum += Int(pixel[0])
                    gSum += Int(pixel[1])
                    bSum += Int(pixel[2])
                    count += 1
                }
            }
        }
        
        if count > 0 {
            let avgR = CGFloat(rSum / count) / 255.0
            let avgG = CGFloat(gSum / count) / 255.0
            let avgB = CGFloat(bSum / count) / 255.0
            let detectedColor = UIColor(red: avgR, green: avgG, blue: avgB, alpha: 1.0)
            
            DispatchQueue.main.async {
                self.updateUI(detectedColor: detectedColor)
            }
        }
    }
}
```

---

### Screen 5: Painting Progress Tracker
**Purpose**: Track which layers are completed

**UI Elements**:
- Checklist of all layers in paint order
- Each item shows:
  - Layer number
  - Color swatch
  - Color name
  - Checkbox (completed/pending)
- Progress bar (X of Y layers complete)
- "Reset Progress" button

**Implementation**:
```kotlin
// Android (Kotlin) - Save progress locally
data class LayerProgress(
    val layerIndex: Int,
    val isCompleted: Boolean,
    val completedTimestamp: Long? = null
)

// Use SharedPreferences or Room database
fun saveProgress(orderId: String, progress: List<LayerProgress>) {
    val sharedPrefs = context.getSharedPreferences("painting_progress", Context.MODE_PRIVATE)
    val json = Gson().toJson(progress)
    sharedPrefs.edit().putString(orderId, json).apply()
}

fun loadProgress(orderId: String): List<LayerProgress> {
    val sharedPrefs = context.getSharedPreferences("painting_progress", Context.MODE_PRIVATE)
    val json = sharedPrefs.getString(orderId, null) ?: return emptyList()
    return Gson().fromJson(json, Array<LayerProgress>::class.java).toList()
}
```

---

## 🎨 Color Matching Accuracy Tips

### For Best Results (User Instructions):
1. **Good Lighting**: Natural daylight or white LED light
2. **White Background**: Place mixed paint on white paper/palette
3. **Steady Camera**: Hold device still for 2-3 seconds
4. **Close Distance**: Camera 6-8 inches from paint sample
5. **Fill Target Circle**: Ensure paint fills the center circle

### Technical Optimization:
- **Frame Averaging**: Average 10-30 frames to reduce noise
- **Color Space Conversion**: Convert to LAB color space for perceptual accuracy
- **Calibration**: Optional white balance calibration step

---

## 📦 Data Models

### Android (Kotlin)
```kotlin
data class Order(
    val orderId: String = "",
    val timestamp: Long = 0,
    val paypalStatus: String = "",
    val numStencils: Int = 0,
    val pricing: Pricing = Pricing(),
    val storageUrls: List<StorageUrl> = emptyList(),
    val metadata: Metadata = Metadata(),
    val paintingGuide: PaintingGuide = PaintingGuide()
)

data class Pricing(
    val total: String = "0.00"
)

data class StorageUrl(
    val layerIndex: Int = 0,
    val pngFileName: String = "",
    val pngUrl: String = "",
    val svgFileName: String = "",
    val svgUrl: String = "",
    val threshold: List<Int> = emptyList()
)

data class Metadata(
    val layerMode: String = "",
    val stencilMode: String = "",
    val originalImageName: String = ""
)

data class PaintingGuide(
    val layerColors: List<LayerColor> = emptyList(),
    val totalLayers: Int = 0,
    val instructions: String = ""
)

data class LayerColor(
    val layerIndex: Int = 0,
    val paintOrder: Int = 0,
    val color: ColorInfo = ColorInfo(),
    val threshold: List<Int> = emptyList()
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
```

### iOS (Swift)
```swift
struct Order: Codable {
    let orderId: String
    let timestamp: Int64
    let paypalStatus: String
    let numStencils: Int
    let pricing: Pricing
    let storageUrls: [StorageUrl]
    let metadata: Metadata
    let paintingGuide: PaintingGuide
}

struct Pricing: Codable {
    let total: String
}

struct StorageUrl: Codable {
    let layerIndex: Int
    let pngFileName: String
    let pngUrl: String
    let svgFileName: String
    let svgUrl: String
    let threshold: [Int]
}

struct Metadata: Codable {
    let layerMode: String
    let stencilMode: String
    let originalImageName: String
}

struct PaintingGuide: Codable {
    let layerColors: [LayerColor]
    let totalLayers: Int
    let instructions: String
}

struct LayerColor: Codable {
    let layerIndex: Int
    let paintOrder: Int
    let color: ColorInfo
    let threshold: [Int]
}

struct ColorInfo: Codable {
    let hex: String
    let rgb: RGBColor
    let name: String
}

struct RGBColor: Codable {
    let r: Int
    let g: Int
    let b: Int
}
```

---

## 🚀 Implementation Phases

### Phase 1: Authentication & Order Viewing (Week 1-2)
- ✅ Firebase Auth integration
- ✅ Login/Register screens
- ✅ Orders list screen
- ✅ Order details screen
- ✅ Download layer images

### Phase 2: Color Guide Display (Week 3)
- ✅ Parse and display layerColors from Firebase
- ✅ Visual color swatches
- ✅ Paint order sequence
- ✅ Copy color values feature

### Phase 3: Camera Color Matching (Week 4-5)
- ✅ Camera permission handling
- ✅ Live camera preview
- ✅ Center sampling circle UI
- ✅ Real-time color extraction
- ✅ Color comparison algorithm
- ✅ Suggestion engine

### Phase 4: Progress Tracking (Week 6)
- ✅ Layer completion checkboxes
- ✅ Local storage of progress
- ✅ Progress statistics

### Phase 5: Polish & Testing (Week 7-8)
- ✅ UI/UX refinements
- ✅ Error handling
- ✅ Offline mode support
- ✅ Performance optimization
- ✅ Beta testing

---

## 🎯 User Experience Flow

### Happy Path Journey
```
1. User receives physical stencils in mail
2. Opens mobile app and logs in
3. Sees their order in the list
4. Taps order to view details
5. Downloads all layer PNG files
6. Views color guide: "Layer 1: Dark Navy"
7. Mixes paint based on RGB values
8. Taps "Match Paint" button
9. Points camera at mixed paint
10. App shows: "85% match - Add more blue"
11. Adjusts paint mixture
12. App shows: "95% match - Perfect! 🎉"
13. Marks Layer 1 as complete
14. Moves to Layer 2
15. Repeats process for all layers
16. Completes painting!
```

---

## 📱 Permissions Required

### Android
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### iOS (Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is required to match paint colors</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save stencil layer images to your photo library</string>
```

---

## 🔧 Firebase Configuration

### Android (google-services.json)
```json
{
  "project_info": {
    "project_id": "your-project-id",
    "firebase_url": "https://your-project-id.firebaseio.com"
  }
}
```

### iOS (GoogleService-Info.plist)
```xml
<key>DATABASE_URL</key>
<string>https://your-project-id.firebaseio.com</string>
<key>STORAGE_BUCKET</key>
<string>your-project-id.appspot.com</string>
```

---

## 🎨 Design Guidelines

### Color Palette
- **Primary**: `#8B5CF6` (Purple - matches web app)
- **Secondary**: `#EC4899` (Pink)
- **Success**: `#10B981` (Green - for "Perfect Match")
- **Warning**: `#F59E0B` (Orange - for "Close Match")
- **Error**: `#EF4444` (Red - for "Poor Match")
- **Background**: `#F9FAFB` (Light Gray)
- **Text**: `#111827` (Dark Gray)

### Typography
- **Headers**: Bold, 24sp/pt
- **Body**: Regular, 16sp/pt
- **Captions**: Regular, 14sp/pt
- **Color Values**: Monospace, 12sp/pt

### Iconography
- Use Material Icons (Android) or SF Symbols (iOS)
- Consistent 24dp/pt size
- Primary color for active states

---

## 🧪 Testing Scenarios

### Unit Tests
- Color similarity calculation accuracy
- Suggestion algorithm correctness
- RGB/Hex conversion functions
- Firebase data parsing

### Integration Tests
- Firebase Authentication flow
- Firebase Realtime Database queries
- Firebase Storage downloads
- Camera permission handling

### UI Tests
- Login flow
- Order list display
- Layer download
- Camera color matching
- Progress tracking

### Manual Testing
- Test with various paint colors
- Test in different lighting conditions
- Test with different camera angles
- Test offline mode
- Test with slow internet

---

## 📊 Analytics & Monitoring

### Track These Events:
- `user_login`
- `order_viewed`
- `layer_downloaded`
- `color_matching_started`
- `color_matching_success` (90%+ match)
- `layer_marked_complete`
- `painting_completed` (all layers done)

### Firebase Analytics Implementation:
```kotlin
// Android
FirebaseAnalytics.getInstance(context).logEvent("layer_downloaded") {
    param("order_id", orderId)
    param("layer_index", layerIndex)
}
```

```swift
// iOS
Analytics.logEvent("layer_downloaded", parameters: [
    "order_id": orderId,
    "layer_index": layerIndex
])
```

---

## 🔐 Security Considerations

1. **Authentication**: Only logged-in users access their own orders
2. **Storage URLs**: Firebase Storage rules restrict access to owner
3. **Database Rules**: Firebase RTDB rules prevent unauthorized reads
4. **API Keys**: Never hardcode in app (use Firebase config files)
5. **SSL Pinning**: Consider for production builds

### Firebase Rules Example:
```json
{
  "rules": {
    "users": {
      "$uid": {
        "stencilOrders": {
          ".read": "$uid === auth.uid",
          ".write": false
        }
      }
    }
  }
}
```

---

## 📚 Dependencies

### Android (build.gradle)
```gradle
dependencies {
    // Firebase
    implementation platform('com.google.firebase:firebase-bom:32.0.0')
    implementation 'com.google.firebase:firebase-auth-ktx'
    implementation 'com.google.firebase:firebase-database-ktx'
    implementation 'com.google.firebase:firebase-storage-ktx'
    implementation 'com.google.firebase:firebase-analytics-ktx'
    
    // CameraX
    implementation "androidx.camera:camera-camera2:1.3.0"
    implementation "androidx.camera:camera-lifecycle:1.3.0"
    implementation "androidx.camera:camera-view:1.3.0"
    
    // Image Processing
    implementation 'org.opencv:opencv:4.7.0'
    
    // Networking
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    
    // UI
    implementation 'androidx.compose.ui:ui:1.5.0'
    implementation 'androidx.compose.material3:material3:1.1.0'
    implementation 'io.coil-kt:coil-compose:2.4.0'
}
```

### iOS (Podfile)
```ruby
pod 'Firebase/Auth'
pod 'Firebase/Database'
pod 'Firebase/Storage'
pod 'Firebase/Analytics'
pod 'Alamofire', '~> 5.6'
pod 'SDWebImage', '~> 5.0'
```

---

## 🚀 Deployment

### Android
1. Build signed APK/AAB
2. Upload to Google Play Console
3. Beta testing via internal track
4. Gradual rollout to production

### iOS
1. Archive app in Xcode
2. Upload to App Store Connect
3. TestFlight beta testing
4. Submit for App Store review
5. Phased release

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: Camera not working
- **Solution**: Check permissions, restart app

**Issue**: Colors not downloading
- **Solution**: Check internet connection, verify Firebase Auth

**Issue**: Color matching inaccurate
- **Solution**: Improve lighting, use white background, hold camera closer

**Issue**: Login fails
- **Solution**: Verify email/password, check internet, contact support

---

## 📝 Future Enhancements

### Version 2.0 Ideas
- ✨ AR preview: See how finished painting will look
- 🎨 Custom color mixing calculator
- 📸 Take photos of progress and share on social media
- 🏆 Achievement badges for completing paintings
- 👥 Community gallery of completed paintings
- 🛒 In-app purchase of additional stencils
- 🌍 Multi-language support
- ♿ Accessibility features (voice guidance, colorblind mode)

---

## 🎯 Success Metrics

### Key Performance Indicators (KPIs)
- **User Activation**: % of users who download at least 1 layer
- **Feature Adoption**: % of users who use camera color matching
- **Completion Rate**: % of users who mark all layers complete
- **Color Match Success**: Average similarity percentage achieved
- **Session Duration**: Time spent in app per session
- **Retention**: Day 1, Day 7, Day 30 retention rates

---

## 📖 Claude Prompt Summary for Mobile Developer

**Here's what you're building:**

A companion mobile app (Android/iOS) for customers who purchased stencil painting kits from the web app. The app needs:

1. **Firebase Authentication** - Users login with same credentials as web app
2. **Order Viewing** - Display all purchased stencil orders from `/users/{userId}/stencilOrders`
3. **Layer Downloads** - Download PNG files from Firebase Storage to device
4. **Color Guide** - Show extracted colors with RGB/hex values for each layer in paint order
5. **Camera Color Matching** - Real-time camera feed that:
   - Samples center of frame
   - Compares detected color to target color
   - Shows % match (Euclidean distance in RGB space)
   - Provides smart suggestions: "Add more white", "Add blue", "Perfect match!"
6. **Progress Tracking** - Checkboxes to mark layers complete, save locally

**Data flows from Firebase RTDB** at `/users/{userId}/stencilOrders/{orderId}` containing:
- `storageUrls[]` - PNG download URLs
- `paintingGuide.layerColors[]` - Color info with RGB, hex, name, paintOrder

**Core algorithm** for color matching:
```
1. Extract RGB from camera center (50x50 pixel area)
2. Calculate Euclidean distance: sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)
3. Convert to percentage: (1 - distance/maxDistance) * 100
4. Generate suggestions based on RGB differences and brightness
```

Use CameraX (Android) or AVFoundation (iOS). Sample ~30 frames and average for stability. Show live preview with target color overlay and real-time % match + suggestions.

---

**Status**: 📱 Ready for mobile development  
**Last Updated**: November 26, 2025
