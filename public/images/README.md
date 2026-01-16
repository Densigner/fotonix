# Fotonix Images Directory Structure

## 📁 Image Organization

### `/public/images/` - Main Images Directory
All images in the public folder can be accessed directly via URL paths.

```
public/images/
├── hero/                    # Hero slider images
│   ├── hero-slide-1.jpg    # Main Lumina Mirror showcase
│   ├── hero-slide-2.jpg    # AI features demonstration
│   ├── hero-slide-3.jpg    # Lighting technology
│   └── hero-slide-4.jpg    # Smart home integration
│
├── products/               # Product images
│   ├── lumina-mirror.jpg   # Main Lumina product image
│   ├── mirror-pro.jpg     # Mirror Pro product image
│   ├── mirror-lite.jpg    # Mirror Lite product image
│   └── accessories.jpg    # Smart accessories
│
├── testimonials/          # Customer photos
│   ├── sarah-johnson.jpg  # Customer testimonial photo
│   ├── michael-chen.jpg   # Customer testimonial photo
│   ├── emma-williams.jpg  # Customer testimonial photo
│   └── david-thompson.jpg # Customer testimonial photo
│
└── features/              # Feature demonstration images
    ├── ai-analysis.jpg    # AI-powered insights
    ├── lighting-demo.jpg  # Adaptive lighting
    ├── smart-home.jpg     # Smart home integration
    └── health-tracking.jpg # Health & wellness tracking
```

## 🖼️ Image Guidelines

### Recommended Sizes:
- **Hero Images**: 1920x1080px (Full HD)
- **Product Images**: 800x800px (Square)
- **Testimonial Photos**: 300x300px (Square)
- **Feature Images**: 1200x800px (Landscape)

### File Formats:
- **JPG**: For photographs and hero images
- **PNG**: For images with transparency
- **WebP**: For modern browsers (optional optimization)

### File Naming:
- Use lowercase
- Use hyphens for spaces
- Be descriptive: `lumina-mirror-bathroom-setup.jpg`

## 🚀 How to Use Images in Components

### In React Components:
```jsx
// For images in public folder
<img src="/images/hero/hero-slide-1.jpg" alt="Fotonix Lumina Mirror" />

// Or with process.env.PUBLIC_URL for better compatibility
<img src={`${process.env.PUBLIC_URL}/images/hero/hero-slide-1.jpg`} alt="Fotonix Lumina Mirror" />
```

### In CSS:
```css
.hero-background {
  background-image: url('/images/hero/hero-slide-1.jpg');
}
```

## 📝 Current Placeholder Images

The sliders currently use placeholder URLs that should be replaced:
- `/api/placeholder/1200/800` → Replace with actual hero images
- `/api/placeholder/60/60` → Replace with customer photos

## 🎯 Next Steps

1. Add your actual product images to the appropriate folders
2. Update the slider components to use real image paths
3. Optimize images for web (compress, resize as needed)
4. Consider adding a loading state for images
