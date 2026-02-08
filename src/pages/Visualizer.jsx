import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, RefreshCw, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { paintDatabase } from '../data/paintDatabase';
import {
    analyzeLighting,
    applyRealisticPaint,
    blendEdges
} from '../utils/advancedPaintEngine';
import styles from './Visualizer.module.css';
import wallImageDefault from '../assets/wallimg.jpeg';

const ALL_TONES = ['violet', 'indigo', 'blue', 'green', 'yellow', 'orange', 'red', 'neutral'];

const Visualizer = () => {
    const { t } = useLanguage();
    const [image, setImage] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [paintType, setPaintType] = useState('exterior');
    const [selectedTone, setSelectedTone] = useState('all');
    const [selectedBrand, setSelectedBrand] = useState('all');
    const [selectedColor, setSelectedColor] = useState(null);
    const [toolMode, setToolMode] = useState('wallFill');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [validationError, setValidationError] = useState(null);
    const [lightingData, setLightingData] = useState(null);
    const [processingStage, setProcessingStage] = useState('');
    const [wallBoundaryCanvas, setWallBoundaryCanvas] = useState(null);
    
    // NEW: Detection settings
    const [edgeThreshold, setEdgeThreshold] = useState(40);
    const [colorTolerance, setColorTolerance] = useState(70);
    
    // NEW: Debounce timer for smooth color changes
    const paintTimerRef = useRef(null);
    const isPaintingRef = useRef(false);
    
    const canvasRef = useRef(null);
    const lastAutoPaintRef = useRef(null);

    const formatLabel = (value, fallback = 'Unknown') => {
        if (!value || typeof value !== 'string') return fallback;
        return value
            .split(/[_\s-]+/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    };

    const getActiveMaskSource = () => {
        if (wallBoundaryCanvas?.wallMap) {
            return {
                mask: wallBoundaryCanvas.wallMap,
                width: wallBoundaryCanvas.width,
                height: wallBoundaryCanvas.height
            };
        }
        return null;
    };

    const mapMaskToCanvas = (maskData, sourceWidth, sourceHeight) => {
        const canvas = canvasRef.current;
        if (!canvas || !maskData || !sourceWidth || !sourceHeight) return null;
        if (sourceWidth === canvas.width && sourceHeight === canvas.height) return maskData;
        
        const scaled = new Uint8Array(canvas.width * canvas.height);
        const scaleX = sourceWidth / canvas.width;
        const scaleY = sourceHeight / canvas.height;
        
        for (let y = 0; y < canvas.height; y++) {
            const sy = Math.min(Math.floor(y * scaleY), sourceHeight - 1);
            for (let x = 0; x < canvas.width; x++) {
                const sx = Math.min(Math.floor(x * scaleX), sourceWidth - 1);
                scaled[y * canvas.width + x] = maskData[sy * sourceWidth + sx];
            }
        }
        return scaled;
    };

    // ========================================
    // OPTIMIZED WALL DETECTION - NO LINES, FAST
    // ========================================
    const detectWallAreas = (img) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Optimize processing size for speed
        const maxWidth = 600; // Reduced for faster processing
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        console.log('🎨 Optimized detection:', width, 'x', height);
        setProcessingStage('Analyzing image...');

        // STEP 1: Convert to grayscale
        const gray = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        
        // STEP 2: Edge detection - SIMPLIFIED for speed
        const edges = new Uint8Array(width * height);
        for (let y = 2; y < height - 2; y++) {
            for (let x = 2; x < width - 2; x++) {
                const idx = y * width + x;
                
                // Simple horizontal and vertical gradients
                const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
                const gy = Math.abs(gray[idx + width] - gray[idx - width]);
                const magnitude = gx + gy;
                
                edges[idx] = magnitude > edgeThreshold ? 1 : 0;
            }
        }

        setProcessingStage('Detecting walls...');

        // STEP 3: Smart exclusion map
        const excludeMap = new Uint8Array(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const brightness = gray[idx];
                const pixelIdx = idx * 4;
                const r = data[pixelIdx];
                const g = data[pixelIdx + 1];
                const b = data[pixelIdx + 2];
                
                // Sky exclusion (top 12%)
                if (y < height * 0.12 && brightness > 170) {
                    excludeMap[idx] = 1;
                    continue;
                }
                
                // Ground exclusion (bottom 8%)
                if (y > height * 0.92 && brightness < 110) {
                    excludeMap[idx] = 1;
                    continue;
                }
                
                // Extreme brightness
                if (brightness < 15 || brightness > 250) {
                    excludeMap[idx] = 1;
                    continue;
                }
                
                // Strong edges
                if (edges[idx] === 1) {
                    excludeMap[idx] = 1;
                    continue;
                }
                
                // Vegetation
                if (g > r + 35 && g > b + 30) {
                    excludeMap[idx] = 1;
                    continue;
                }
                
                // Windows/very bright spots
                if (brightness > 235 && y > height * 0.15 && y < height * 0.85) {
                    excludeMap[idx] = 1;
                }
            }
        }

        // STEP 4: Generate wall seed points - OPTIMIZED
        const seedPoints = [];
        const seedStride = 10; // Larger stride for speed
        
        for (let y = Math.floor(height * 0.30); y < height * 0.70; y += seedStride) {
            for (let x = Math.floor(width * 0.20); x < width * 0.80; x += seedStride) {
                const idx = y * width + x;
                if (excludeMap[idx] === 0 && edges[idx] === 0) {
                    const brightness = gray[idx];
                    if (brightness > 60 && brightness < 210) {
                        seedPoints.push(idx);
                    }
                }
            }
        }

        console.log('🌱 Seeds:', seedPoints.length);

        if (seedPoints.length === 0) {
            seedPoints.push(Math.floor(height * 0.5) * width + Math.floor(width * 0.5));
        }

        // Calculate reference color
        let avgR = 0, avgG = 0, avgB = 0;
        for (const idx of seedPoints) {
            const p = idx * 4;
            avgR += data[p];
            avgG += data[p + 1];
            avgB += data[p + 2];
        }
        avgR /= seedPoints.length;
        avgG /= seedPoints.length;
        avgB /= seedPoints.length;

        console.log('🎯 Wall color:', Math.round(avgR), Math.round(avgG), Math.round(avgB));

        // STEP 5: Fast region growing with 8-connectivity for better filling
        const wallMask = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        const queue = [...seedPoints];
        
        for (const idx of seedPoints) {
            visited[idx] = 1;
        }
        
        while (queue.length > 0) {
            const idx = queue.shift();
            const x = idx % width;
            const y = Math.floor(idx / width);
            
            if (excludeMap[idx] === 0) {
                const p = idx * 4;
                const colorDist = Math.abs(data[p] - avgR) + 
                                Math.abs(data[p + 1] - avgG) + 
                                Math.abs(data[p + 2] - avgB);
                
                if (colorDist < colorTolerance) {
                    wallMask[idx] = 1;
                    
                    // 8-connected neighbors for complete filling
                    const neighbors = [
                        idx - 1, idx + 1,           // horizontal
                        idx - width, idx + width,   // vertical
                        idx - width - 1, idx - width + 1,  // diagonal top
                        idx + width - 1, idx + width + 1   // diagonal bottom
                    ];
                    
                    for (const nIdx of neighbors) {
                        if (nIdx < 0 || nIdx >= width * height || visited[nIdx]) continue;
                        
                        const nx = nIdx % width;
                        const ny = Math.floor(nIdx / width);
                        
                        // Prevent wrapping
                        if (Math.abs(nx - x) <= 1 && Math.abs(ny - y) <= 1) {
                            visited[nIdx] = 1;
                            queue.push(nIdx);
                        }
                    }
                }
            }
        }

        setProcessingStage('Smoothing...');

        // STEP 6: Advanced morphological operations - REMOVE HORIZONTAL LINES
        const temp = new Uint8Array(width * height);
        
        // First pass: Closing operation (fill gaps)
        for (let y = 2; y < height - 2; y++) {
            for (let x = 2; x < width - 2; x++) {
                const idx = y * width + x;
                
                if (wallMask[idx] === 1) {
                    temp[idx] = 1;
                } else {
                    // Count surrounding wall pixels in 5x5 area
                    let count = 0;
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            if (wallMask[(y+dy)*width + (x+dx)] === 1) count++;
                        }
                    }
                    // Fill if mostly surrounded
                    if (count >= 15) temp[idx] = 1;
                }
            }
        }

        // Second pass: Remove small isolated regions and horizontal artifacts
        const final = new Uint8Array(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                if (temp[idx] === 1) {
                    // Check for horizontal line artifacts
                    const left = temp[idx - 1];
                    const right = temp[idx + 1];
                    const up = temp[idx - width];
                    const down = temp[idx + width];
                    const upLeft = temp[idx - width - 1];
                    const upRight = temp[idx - width + 1];
                    const downLeft = temp[idx + width - 1];
                    const downRight = temp[idx + width + 1];
                    
                    const neighbors = left + right + up + down + upLeft + upRight + downLeft + downRight;
                    
                    // Only keep if well-connected (not isolated line)
                    if (neighbors >= 3) {
                        final[idx] = 1;
                    }
                }
            }
        }

        // Calculate coverage
        let coverage = 0;
        for (let i = 0; i < final.length; i++) {
            if (final[i] === 1) coverage++;
        }
        
        const coveragePercent = (coverage / (width * height) * 100).toFixed(1);
        console.log('✅ Detection:', coveragePercent + '%,', coverage, 'pixels');

        setProcessingStage('');

        return {
            canvas,
            wallMap: final,
            width,
            height,
            coverage: coveragePercent
        };
    };

    const paintAllWalls = (colorHex) => {
        if (!selectedColor || isPaintingRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        isPaintingRef.current = true;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const maskSource = getActiveMaskSource();
        if (!maskSource) {
            isPaintingRef.current = false;
            return;
        }

        const normalizedMask = mapMaskToCanvas(maskSource.mask, maskSource.width, maskSource.height);
        if (!normalizedMask) {
            isPaintingRef.current = false;
            return;
        }

        const painted = applyRealisticPaint(
            imageData,
            normalizedMask,
            colorHex,
            lightingData,
            canvas.width,
            canvas.height,
            {
                surfaceCondition: analysisResult?.details?.condition,
                wallType: analysisResult?.details?.type,
                surfaceType: analysisResult?.details?.surfaceType
            }
        );

        if (painted > 0) {
            blendEdges(imageData, normalizedMask, canvas.width, canvas.height);
            ctx.putImageData(imageData, 0, 0);
            console.log('✅ Paint applied:', painted, 'pixels');
        }
        
        isPaintingRef.current = false;
    };

    // DEBOUNCED paint function - prevents lag
    const debouncedPaint = (colorHex) => {
        // Clear existing timer
        if (paintTimerRef.current) {
            clearTimeout(paintTimerRef.current);
        }
        
        // Set new timer - only paint after user stops changing color
        paintTimerRef.current = setTimeout(() => {
            if (image && wallBoundaryCanvas) {
                drawImage(image);
                setTimeout(() => paintAllWalls(colorHex), 50);
            }
        }, 150); // 150ms debounce - feels instant but prevents lag
    };

    const analyzeImage = async (img) => {
        setAnalyzing(true);
        setAnalysisResult(null);
        setValidationError(null);
        
        try {
            setProcessingStage('Analyzing image properties...');
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            let totalBrightness = 0;
            let topBrightness = 0;
            let topPixels = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                totalBrightness += brightness;
                
                const pixelIdx = i / 4;
                const y = Math.floor(pixelIdx / canvas.width);
                if (y < canvas.height * 0.20) {
                    topBrightness += brightness;
                    topPixels++;
                }
            }
            
            const avgBrightness = totalBrightness / (data.length / 4);
            const avgTopBrightness = topBrightness / topPixels;
            const isExterior = avgTopBrightness > 180 || avgBrightness > 120;

            const validation = {
                isBuilding: true,
                type: isExterior ? 'exterior' : 'interior',
                surfaceType: 'plastered wall',
                condition: 'clean',
                confidence: 'high'
            };

            setPaintType(validation.type);

            const lighting = analyzeLighting(imageData, canvas.width, canvas.height);
            lighting.surfaceCondition = validation.condition;
            lighting.wallType = validation.type;
            lighting.surfaceType = validation.surfaceType;
            setLightingData(lighting);

            setAnalysisResult({
                message: `${formatLabel(validation.type)} • ${formatLabel(validation.surfaceType)} • Smart Detection`,
                details: validation
            });

        } catch (error) {
            console.error('Analysis error:', error);
        } finally {
            setAnalyzing(false);
            setProcessingStage('');
        }
    };

    const availableBrands = useMemo(() => {
        const typeData = paintDatabase[paintType];
        if (!typeData) return [];
        const brands = new Set(ALL_TONES.flatMap(tone => (typeData[tone] || []).map(c => c.brand)));
        return Array.from(brands).sort();
    }, [paintType]);

    const filteredColors = useMemo(() => {
        const typeData = paintDatabase[paintType];
        if (!typeData) return [];
        
        let toneFilter = selectedTone === 'all' ? ALL_TONES : [selectedTone];
        toneFilter = toneFilter.filter(tone => typeData[tone]);
        let colors = toneFilter.flatMap(tone => typeData[tone] || []);
        
        if (selectedBrand !== 'all') {
            colors = colors.filter(c => c.brand === selectedBrand);
        }
        
        return colors;
    }, [paintType, selectedTone, selectedBrand]);

    useEffect(() => {
        if (filteredColors.length > 0 && (!selectedColor || !filteredColors.find(c => c.code === selectedColor.code))) {
            setSelectedColor(filteredColors[0]);
        }
    }, [filteredColors, selectedColor]);

    const drawImage = (img) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const containerWidth = canvas.parentElement?.clientWidth || 800;
        const scale = Math.min(1, containerWidth / img.width);
        
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const wallData = detectWallAreas(img);
        setWallBoundaryCanvas(wallData);
    };

    useEffect(() => {
        if (image && canvasRef.current) {
            // Only redraw when image actually changes, not on settings change
            drawImage(image);
        }
    }, [image]);

    useEffect(() => {
        if (image && selectedColor && wallBoundaryCanvas && toolMode === 'wallFill') {
            debouncedPaint(selectedColor.hex);
        }
        
        // Cleanup timer on unmount
        return () => {
            if (paintTimerRef.current) {
                clearTimeout(paintTimerRef.current);
            }
        };
    }, [selectedColor, toolMode]);

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setImage(img);
            setImageLoaded(true);
            setTimeout(() => analyzeImage(img), 100);
        };
        img.src = wallImageDefault;
    }, []);

    const handleCanvasClick = (e) => {
        if (image && selectedColor) {
            drawImage(image);
            setTimeout(() => paintAllWalls(selectedColor.hex), 50);
        }
    };

    const handleReset = () => {
        if (image) {
            drawImage(image);
            setAnalysisResult(null);
        }
    };

    const onDrop = (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    setImage(img);
                    analyzeImage(img);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 1
    });

    return (
        <div className={styles.visualizerPage}>
            <div className="container">
                <h1 className="title-gradient">{t('visualizer.title')}</h1>
                
                {validationError && (
                    <div className={styles.errorBanner}>
                        <AlertCircle size={20} />
                        {validationError}
                    </div>
                )}

                <div className={styles.workspace}>
                    <div className={styles.featuredColorsOutside}>
                        <h3>Select Tone (VIBGYOR)</h3>
                        <div className={styles.toneSelector}>
                            <button
                                type="button"
                                className={`${styles.toneBtn} ${selectedTone === 'all' ? styles.activeTone : ''}`}
                                onClick={() => setSelectedTone('all')}
                            >
                                All
                            </button>
                            {ALL_TONES.map(tone => (
                                <button
                                    type="button"
                                    key={tone}
                                    className={`${styles.toneBtn} ${selectedTone === tone ? styles.activeTone : ''}`}
                                    onClick={() => setSelectedTone(tone)}
                                >
                                    {formatLabel(tone)}
                                </button>
                            ))}
                        </div>

                        {/* NEW: Detection Settings Controls */}
                        <div style={{ marginTop: '2rem' }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Detection Settings</h3>
                            
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                    Edge Sensitivity: {edgeThreshold}
                                </label>
                                <input
                                    type="range"
                                    min="20"
                                    max="80"
                                    value={edgeThreshold}
                                    onChange={(e) => {
                                        setEdgeThreshold(parseInt(e.target.value));
                                        // Redraw image when settings change
                                        if (image) {
                                            setTimeout(() => {
                                                drawImage(image);
                                                if (selectedColor && toolMode === 'wallFill') {
                                                    setTimeout(() => paintAllWalls(selectedColor.hex), 100);
                                                }
                                            }, 300);
                                        }
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                    Color Tolerance: {colorTolerance}
                                </label>
                                <input
                                    type="range"
                                    min="40"
                                    max="120"
                                    value={colorTolerance}
                                    onChange={(e) => {
                                        setColorTolerance(parseInt(e.target.value));
                                        // Redraw image when settings change
                                        if (image) {
                                            setTimeout(() => {
                                                drawImage(image);
                                                if (selectedColor && toolMode === 'wallFill') {
                                                    setTimeout(() => paintAllWalls(selectedColor.hex), 100);
                                                }
                                            }, 300);
                                        }
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.mainArea}>
                        {!image ? (
                            <div
                                {...getRootProps()}
                                className={`${styles.dropzone} ${isDragActive ? styles.dragActive : ''}`}
                            >
                                <input {...getInputProps()} />
                                <Upload size={48} />
                                <p>Drag building image or click to upload</p>
                            </div>
                        ) : (
                            <div className={styles.canvasContainer}>
                                <canvas ref={canvasRef} onClick={handleCanvasClick} />
                                {analyzing && (
                                    <div className={styles.overlay}>
                                        <div className={styles.spinner}></div>
                                        <p>{processingStage || 'Processing...'}</p>
                                    </div>
                                )}
                                {analysisResult && (
                                    <div className={styles.badge}>
                                        {analysisResult.message}
                                        {wallBoundaryCanvas?.coverage && (
                                            <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>
                                                • {wallBoundaryCanvas.coverage}% coverage
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.sidebar}>
                        <div className={styles.sidebarContent}>
                            <h3 style={{ marginTop: '0' }}>All Shades</h3>

                            <h3 style={{ fontSize: '0.8rem', marginTop: '1rem', marginBottom: '1rem' }}>
                                Select Brand
                            </h3>
                            <select
                                value={selectedBrand}
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                className={styles.brandSelect}
                            >
                                <option value="all">All Brands</option>
                                {availableBrands.map(brand => (
                                    <option key={brand} value={brand}>{brand}</option>
                                ))}
                            </select>

                            <div className={styles.colorGridWrapper}>
                                <div className={styles.colorGrid}>
                                    {filteredColors.map((color, index) => {
                                        const isActive = selectedColor?.code === color.code;
                                        return (
                                            <button
                                                type="button"
                                                key={`${color.code}-${color.brand}-${index}`}
                                                className={`${styles.colorItem} ${isActive ? styles.activeColor : ''}`}
                                                onClick={() => setSelectedColor(color)}
                                            >
                                                <div
                                                    className={styles.colorChip}
                                                    style={{ backgroundColor: color.hex }}
                                                    title={`${color.name} • ${color.code}`}
                                                />
                                                <div className={styles.colorMeta}>
                                                    <span className={styles.colorCode}>{color.code}</span>
                                                    <span className={styles.colorName}>{color.name}</span>
                                                    <span className={styles.colorBrand}>{color.brand}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button className={styles.resetBtn} onClick={handleReset}>
                                <RefreshCw size={16} /> Reset
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Visualizer;