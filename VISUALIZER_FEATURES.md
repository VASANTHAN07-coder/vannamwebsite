# Visualizer - Advanced Paint Application Features

## 🎨 Overview

The Visualizer is now equipped with advanced wall detection and painting capabilities similar to Asian Paints' virtual painter. It analyzes uploaded building images, detects whether they're interior or exterior walls, and provides precision painting tools.

---

## ✨ Key Features

### 1. **AI-Powered Wall Detection**
- **Automatic Classification**: Uses Groq Vision API to analyze images and classify walls as interior or exterior
- **Fallback Detection**: If API fails, uses intelligent color analysis to detect sky ratio and determine wall type
- **Real-time Analysis**: Loading animation shows active analysis process

### 2. **Wall Boundary Visualization**
- **Structural Edge Detection**: Uses Sobel edge detection algorithm to identify wall boundaries
- **Visual Layer**: Toggle boundary visualization to see exactly where walls are detected
- **Prevents Bleeding**: Paint operations respect detected boundaries

### 3. **Advanced Brush Tools**

#### **Brush Mode** 
- **Click & Drag Painting**: Smooth continuous brush strokes
- **Adjustable Brush Size**: 5px - 80px (default: 20px)
- **Opacity Control**: 10% - 100% transparency for layered effects
- **Smooth Interpolation**: Lines between mouse points for smooth strokes
- **Feathered Edges**: Soft brush edges that blend naturally

#### **Fill Mode**
- **Smart Fill Algorithm**: Click-based flood fill with color matching
- **Tolerance Control**: Adjustable sensitivity (1-100) for color range
- **Edge-Respecting**: Stops at detected wall boundaries
- **HSL Blending**: Maintains texture and shadows while applying color

### 4. **Custom Paint Cursor**
- **Animated Brush Cursor**: Shows brush size in real-time
- **Visual Feedback**: Circle indicates painting area
- **Paint Droplet Effect**: Decorative paint drip animation
- **Follows Mouse**: Dynamic cursor that scales with brush size

### 5. **Color Management**
- **VIBGYOR Organization**: Colors organized by color spectrum
- **Brand Filtering**: Filter by paint brand (Asian Paints, Dulux, etc.)
- **Tone Selection**: Browse by specific color tone or all at once
- **Color Preview**: See selected color with brand info

### 6. **Image Processing**
- **Drag & Drop Upload**: Easy image import
- **Multiple Formats**: Supports JPG, PNG, and mobile camera input
- **Smart Scaling**: Automatically scales to fit viewport
- **Seamless Canvas**: Large images fit perfectly without distortion

---

## 🛠️ How to Use

### Step 1: Upload Image
1. Navigate to Visualizer page
2. Drag & drop a building/wall image or click to browse
3. Application automatically analyzes the image

### Step 2: Review Analysis
- A badge appears showing "Interior" or "Exterior" detection
- Check if classification is correct
- Boundaries visualization shows wall detection

### Step 3: Select Paint Color
1. Choose paint type (Interior/Exterior)
2. Select color tone (VIBGYOR)
3. Pick brand from dropdown
4. Click on desired color to select

### Step 4: Paint the Wall

#### **Using Brush Tool:**
1. Click "Brush" button to activate
2. Adjust brush size (5-80px)
3. Adjust opacity for transparent effects
4. Click & drag on the wall to paint
5. Paint only appears on detected wall area

#### **Using Fill Tool:**
1. Click "Fill" button to activate
2. Adjust tolerance for color matching
3. Click on area to fill
4. Paint spreads to similar colors, respecting boundaries

### Step 5: Visualize Results
- Toggle "Show/Hide Boundaries" to see wall edges
- Reset to original image anytime
- Paint multiple colors for creative results

---

## 🔧 Technical Details

### Algorithms

#### Sobel Edge Detection
- Detects structural edges using gradient analysis
- Creates boundary map to prevent paint overflow
- Threshold: 25-30 for sensitivity adjustment

#### HSL Color Blending
- Converts RGB to HSL (Hue, Saturation, Lightness)
- Maintains 70% target color, 30% original texture
- Preserves shadows and highlights for realistic look

#### Flood Fill Algorithm
- Uses BFS (Breadth-First Search) queue
- Respects edge maps for boundary stopping
- Tolerance-based color matching

#### Canny-Like Edge Detection
- Custom edge detection for boundary visualization
- Sobel kernels for gradient calculation
- Threshold: 30 for structural features

### APIs Used
- **Groq Vision API**: Image analysis for interior/exterior detection
- **Hugging Face Segmentation**: Optional advanced wall segmentation

### Performance Optimizations
- Canvas rendering with requestAnimationFrame
- Efficient edge detection with Uint8Array
- Lazy boundary calculation
- Memory-efficient brush stroke interpolation

---

## 🎯 Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile: Limited support (camera input available)

---

## 🚀 Advanced Tips

### Achieving Realistic Results
1. **Use lower brush opacity (30-50%)** for textured, realistic painting
2. **Toggle boundaries off** when finished to see final result
3. **Use fill tool** for large uniform areas
4. **Use brush tool** for precision edge work

### Handling Difficult Images
- High-contrast images work best
- Shadows might confuse detection - use fill tolerance adjustment
- Very bright/overcast images may detect as exterior

### Color Selection Tips
- Start with lighter shades for test
- Use opacity to layer colors
- Different brands have same shade in different codes

---

## 📋 Component Structure

```
Visualizer.jsx
├── State Management
│   ├── Image data
│   ├── Paint type (interior/exterior)
│   ├── Brush settings
│   ├── Wall boundaries
│   └── Analysis results
├── Image Processing
│   ├── Edge detection
│   ├── Wall boundary creation
│   └── Color analysis
├── Painting Functions
│   ├── brushPaint()
│   ├── floodFill()
│   └── Mouse handlers
├── UI Components
│   ├── Sidebar (controls)
│   ├── Canvas (painting area)
│   └── PaintCursor (custom cursor)
└── Event Handlers
    ├── Canvas mouse events
    ├── Color selection
    └── Tool switching
```

---

## 🐛 Troubleshooting

### Paint Not Appearing
- Check if color is selected (should show in sidebar)
- Ensure you're painting on detected wall area (not sky/ground)
- Toggle boundaries to visualize valid painting area
- Try adjusting tolerance/opacity

### Incorrect Wall Detection
- Try different light conditions if re-uploading
- Use manual type selector to override detection
- Fallback mode activates if API is unavailable

### Performance Issues
- Large images (>2000px) may be slower
- Try reducing brush size for smoother performance
- Clear browser cache if needed

### Custom Cursor Not Showing
- Ensure JavaScript is enabled
- Try different brush mode
- Refresh page if needed

---

## 🎓 Educational Value

This tool demonstrates:
- Computer Vision (edge detection, image segmentation)
- Canvas API (drawing, pixel manipulation)
- Web APIs (drag-drop, file handling)
- Algorithm implementation (flood fill, BFS)
- Color theory (RGB to HSL conversion)
- Real-time user interaction handling
- Performance optimization techniques

---

## 📝 Future Enhancements

Planned features:
- [ ] Undo/Redo functionality with history stack
- [ ] Save painted result as image
- [ ] Multiple layer support
- [ ] Gradient and pattern fills
- [ ] Texture brushes
- [ ] Mobile touch support optimization
- [ ] Export design as PDF
- [ ] Comparison slider (before/after)
- [ ] Preset color schemes
- [ ] Wall material texture overlay

---

## 📞 Support

For issues or feature requests, please check the console for error messages and ensure:
1. API keys are configured (VITE_GROQ_API_KEY, VITE_HF_API_KEY)
2. Image format is supported
3. Browser supports Canvas API
4. JavaScript is enabled

---

**Version**: 2.0  
**Last Updated**: January 2025  
**Built with**: React, Canvas API, Groq Vision API, Hugging Face Models
