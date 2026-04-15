# DOT Halftone - Quick Reference Card

**REVISION 2 - 2026-01-22**: Added instrumentation, jitter, and steeper probability curve

## 🔒 LASER SAFETY CONSTRAINTS (DO NOT CHANGE)

```javascript
minCutDiameterMm: 0.8  // Minimum dot diameter that cuts through Mylar
minWebMm: 0.4          // Minimum material between dots for structural integrity
```

**NEVER reduce these values.** They are based on laser physics and material testing.

---

## 📊 How Brightness Maps to Dots (REVISION 2 - STEEPER CURVE)

| Luminance | Description | Dot Behavior (NEW) |
|-----------|-------------|-------------------|
| 0.88 - 1.0 | Highlights | ⚪ NO DOTS - true voids (hard cutoff) |
| 0.8 - 0.88 | Very light | 🔘 0-7% dots placed (very sparse) |
| 0.6 - 0.8 | Light midtones | 🔘 7-34% dots placed (sparse) |
| 0.4 - 0.6 | Midtones | 🔘 34-72% dots placed (moderate) |
| 0.2 - 0.4 | Dark midtones | ⚫ 72-100% dots placed (dense) |
| 0.0 - 0.2 | Shadows | ⚫ 100% dots placed (full density) |

**Key changes from Revision 1:**
- Dark threshold lowered from 0.3 to 0.2 (denser shadows)
- Cubic curve creates more aggressive skipping in lighter tones
- Much steeper falloff: 0.6 luminance went from 57% to 34% placement

---

## 🎯 Key Functions (REVISION 2)

### `shouldPlaceDot(luminance, col, row, lightCutoff, stats)`
**Purpose:** Decides whether to place a dot at this grid position  
**Returns:** `true` = place dot, `false` = skip  
**NEW in Rev 2:**
- Added `stats` parameter to track skip reasons
- Changed dark threshold from 0.3 to 0.2
- Uses cubic curve: `Math.pow(1.0 - normalizedLum, 2.5)`
- Increments `stats.skippedByHighlightCutoff` or `stats.skippedByProbability`

**Logic:**
- Luminance ≥ lightCutoff → always skip (highlights)
- Luminance ≤ 0.2 → always place (darks) - **changed from 0.3**
- Between → cubic probability: very steep in lighter tones

### `generateGrid(..., jitterPx, debugLogging)`
**Purpose:** Main grid generation loop with instrumentation  
**NEW in Rev 2:**
- Added `jitterPx` parameter for positional offset
- Added `debugLogging` parameter to enable console output
- Tracks comprehensive statistics during generation
- Applies deterministic jitter to break up uniform grid
- Logs luminance samples for validation
- Prints warnings if placement rate = 100%

**Key Safety Checks:**
1. Check `shouldPlaceDot()` first (with stats tracking)
2. Calculate size with `toneToSizeFactor()`
3. Skip if `radius < minRadiusPx`
4. Apply jitter if enabled
5. Clamp to `maxRadiusPx`

---

## ⚙️ Configuration Parameters (REVISION 2)

### User-Adjustable (in UI)
```javascript
dotSpacingMm: 1.0 - 3.0  // Grid spacing
gamma: 0.6 - 2.0         // Tone curve
contrast: 0.8 - 2.0      // Pre-process contrast
blurRadiusPx: 0 - 5      // Pre-blur smoothing
lightCutoff: 0.7 - 1.0   // Highlight threshold
darkCutoff: 0.0 - 0.2    // Shadow threshold
jitterPx: 0 - 5          // NEW: Positional jitter (0=off, 2-5 recommended)
```

### Fixed (DO NOT EXPOSE)
```javascript
minCutDiameterMm: 0.8    // LASER SAFETY - FIXED
minWebMm: 0.4            // STRUCTURAL - FIXED
minDotSizeFraction: 0.15 // Prevents sub-kerf dots
debugLogging: true       // NEW: Enable console statistics
```

---

## 🔍 Verification - Reading Console Output

### ✅ GOOD Output Example:
```
🎯 DOT PLACEMENT DECISIONS:
   ✓ Dots placed: 5,847
   ✗ Skipped (highlight cutoff): 3,201
   ✗ Skipped (probability): 2,891
   Placement rate: 47.8%

⚠️ VERIFICATION CHECKS:
   ✓ Probabilistic skipping is active (6,092 dots skipped)
```

**What this tells you:**
- ~48% placement = working correctly
- Thousands of dots skipped = probabilistic placement active
- No warnings = luminance correct, skipping working

### ❌ BAD Output Example:
```
🎯 DOT PLACEMENT DECISIONS:
   ✓ Dots placed: 12,219
   ✗ Skipped (highlight cutoff): 0
   ✗ Skipped (probability): 0
   Placement rate: 100.0%

⚠️ VERIFICATION CHECKS:
   ✗ WARNING: NO DOTS WERE SKIPPED!
   ✗ WARNING: ALL available cells got dots (100% placement)
```

**What this tells you:**
- 100% placement = probabilistic placement NOT working
- Zero skips = `shouldPlaceDot()` always returning true
- Warnings triggered = something is broken

### 🔍 Luminance Validation Example:
```
🔍 LUMINANCE SAMPLE VALIDATION:
   1. pos=(0,0) rgb=(245,245,245) lum=0.961
   2. pos=(1,0) rgb=(180,180,180) lum=0.706
   3. pos=(2,0) rgb=(120,120,120) lum=0.471
```

**What to check:**
- ✅ GOOD: rgb=(245,245,245) → lum=0.961 (bright → high luminance)
- ✅ GOOD: rgb=(50,50,50) → lum=0.196 (dark → low luminance)
- ❌ BAD: rgb=(245,245,245) → lum=0.039 (inverted!)
- ❌ BAD: All luminance values = 0.000 or 1.000 (binary/thresholded)

---

## 🧪 Testing Scenarios (REVISION 2)

### Test 1: Highlight Suppression
**Image:** High-key portrait with bright background  
**Expected Console:**
- Skipped (highlight cutoff): > 1000
- Luminance bucket [0.8-1.0]: > 1000 cells
- Placement rate: < 60%
**Expected Visual:** Background completely empty

### Test 2: Midtone Spacing with Jitter
**Image:** Smooth gradient (white → black)  
**Config:** jitterPx = 3
**Expected Console:**
- Placement rate gradient: 0% → 100% across gradient
- Dot size distribution: mix of small/medium/large
**Expected Visual:** Dots irregularly spaced (not perfect rows)

### Test 3: Shadow Density
**Image:** Low-key image with deep shadows  
**Expected:** Full dot density in dark areas (same as before)  
**Verify:** Count dots - should be nearly 100% of grid in darks

### Test 4: Minimum Size Guard
**Image:** Any image  
**Expected:** NO dots with diameter < 0.8mm  
**Verify:** Parse SVG, check all `<circle r="...">` values:  
`r * 2 >= (0.8 / 25.4) * dpi`

---

## 🐛 Common Issues & Solutions

### Issue: "Too many dots in highlights"
**Cause:** `lightCutoff` too high  
**Fix:** Lower `lightCutoff` (try 0.85 instead of 0.88)

### Issue: "Not enough dots overall"
**Cause:** Probabilistic skipping too aggressive  
**Fix:** Check `shouldPlaceDot()` probability curve - may need adjustment

### Issue: "Dots still too small"
**Cause:** `maxRadiusPx` calculated incorrectly  
**Fix:** Verify: `maxRadiusPx = (stepPx - minWebPx) / 2`

### Issue: "Pattern looks random/noisy"
**Cause:** Deterministic seeding not working  
**Fix:** Verify grid position (col, row) is being used as seed

---

## 📈 Performance Metrics

**Expected dot count reduction:**
- High-key images: 30-50% fewer dots
- Normal images: 15-25% fewer dots
- Low-key images: 5-10% fewer dots

**Expected render time:**
- Slightly faster due to fewer dots
- Grid generation still O(n) where n = grid positions

---

## 🔄 Code Flow

```
generateDotHalftoneSVG()
  ↓
preprocessImage()  [blur + contrast]
  ↓
generateGrid()
  ↓
  for each grid position:
    1. Calculate luminance
    2. shouldPlaceDot() ? → skip if false
    3. toneToSizeFactor() → get size
    4. Calculate radius
    5. if radius < minRadiusPx → skip
    6. Add to dots array
  ↓
buildSVG() [output circles]
```

---

## 💡 Design Rationale

**Why probabilistic placement instead of smaller dots?**
- Laser power density: concentrated on larger features cuts better
- Material strength: fewer holes = stronger stencil
- Physics: 0.8mm is the proven minimum, can't go smaller
- Visual: spacing creates proper halftone appearance

**Why deterministic random instead of true random?**
- Reproducibility: same image → same dots every time
- Quality control: customers get what they preview
- Debugging: consistent output aids troubleshooting
- Testing: predictable results for automated tests

---

## 📝 Change Log Reference

For full implementation details, see:
- [CHANGELOG-POST-LAUNCH.md](CHANGELOG-POST-LAUNCH.md) - Technical change log
- [DOT_HALFTONE_IMPROVEMENT_SUMMARY.md](DOT_HALFTONE_IMPROVEMENT_SUMMARY.md) - Visual guide

---

**Last Updated:** 2026-01-22  
**Version:** Post-Launch v1  
**Status:** ✅ Production Ready
