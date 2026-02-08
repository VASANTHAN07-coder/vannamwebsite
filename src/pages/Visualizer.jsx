import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, RefreshCw, Layers, Home as HomeIcon, Brush, Pipette, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { paintDatabase } from '../data/paintDatabase';
import styles from './Visualizer.module.css';
import wallImageDefault from '../assets/wallimg.jpeg';

const Visualizer = () => {
    const { t } = useLanguage();
    const [image, setImage] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [paintType, setPaintType] = useState('interior'); // interior or exterior
    const [selectedTone, setSelectedTone] = useState('all'); // all, violet, indigo, blue, etc.
    const [selectedBrand, setSelectedBrand] = useState('all'); // all, Asian Paints, Dulux, etc.
    const [selectedColor, setSelectedColor] = useState(null);
    const [toolMode, setToolMode] = useState('wallFill');
    const [tolerance, setTolerance] = useState(60); // Paint Spread - Increased for better coverage
    const [wallMask, setWallMask] = useState(null); // AI Wall Segmentation Mask
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [showWallBoundary, setShowWallBoundary] = useState(false); // Toggle boundary layer
    const [wallBoundaryCanvas, setWallBoundaryCanvas] = useState(null); // Stores wall edge detection
    const canvasRef = useRef(null);
    const lastAutoPaintRef = useRef(null);
    const wallMaskMapRef = useRef(null);

    // Get categories available
    const colorTones = ['violet', 'indigo', 'blue', 'green', 'yellow', 'orange', 'red', 'neutral'];

    // Trace continuous lines from scattered boundary points
    const traceContourLines = (points, width, height) => {
        if (points.length === 0) return [];
        
        const lines = [];
        const visited = new Set();
        const maxLines = 2000;
        const maxVisited = 30000;
        
        // Group nearby points into line segments
        for (let i = 0; i < points.length; i++) {
            if (lines.length >= maxLines || visited.size >= maxVisited) break;
            if (visited.has(i)) continue;
            
            const line = [points[i]];
            visited.add(i);
            
            // Find connected points (within 2 pixels)
            let lastPoint = points[i];
            let foundNext = true;
            
            while (foundNext && line.length < 1000) {
                foundNext = false;
                
                for (let j = 0; j < points.length; j++) {
                    if (visited.has(j)) continue;
                    
                    const dist = Math.abs(points[j].x - lastPoint.x) + Math.abs(points[j].y - lastPoint.y);
                    if (dist <= 2) {
                        line.push(points[j]);
                        visited.add(j);
                        lastPoint = points[j];
                        foundNext = true;
                        break;
                    }
                }
            }
            
            // Only keep lines with at least 10 points (filters noise)
            if (line.length >= 10) {
                lines.push(line);
            }
        }
        
        return lines;
    };

    const buildMaskMapFromSegments = async (segments, width, height) => {
        if (!segments || !Array.isArray(segments) || width <= 0 || height <= 0) return null;

        const includeLabels = new Set([
            'wall',
            'building',
            'house',
            'facade',
            'exterior wall',
            'interior wall'
        ]);

        const excludeLabels = new Set([
            'window',
            'door',
            'roof',
            'sky',
            'pole',
            'tree',
            'road',
            'car',
            'person'
        ]);

        const maskMap = new Uint8Array(width * height);
        const excludeMap = new Uint8Array(width * height);

        const loadMaskToMap = async (maskBase64, targetMap) => {
            if (!maskBase64) return;
            const src = maskBase64.startsWith('data:image')
                ? maskBase64
                : `data:image/png;base64,${maskBase64}`;

            const img = new Image();
            const loaded = await new Promise(resolve => {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = src;
            });

            if (!loaded) return;

            const temp = document.createElement('canvas');
            const tctx = temp.getContext('2d');
            temp.width = width;
            temp.height = height;
            tctx.drawImage(img, 0, 0, width, height);

            const data = tctx.getImageData(0, 0, width, height).data;
            for (let i = 0; i < width * height; i++) {
                const pos = i * 4;
                const a = data[pos + 3];
                const brightness = (data[pos] + data[pos + 1] + data[pos + 2]) / 3;
                if (a > 10 && brightness > 120) {
                    targetMap[i] = 1;
                }
            }
        };

        for (const segment of segments) {
            const label = (segment?.label || '').toLowerCase();
            const mask = segment?.mask || segment?.mask_base64;
            if (!mask) continue;

            if (includeLabels.has(label)) {
                await loadMaskToMap(mask, maskMap);
            } else if (excludeLabels.has(label)) {
                await loadMaskToMap(mask, excludeMap);
            }
        }

        for (let i = 0; i < maskMap.length; i++) {
            if (excludeMap[i] === 1) maskMap[i] = 0;
        }

        return maskMap;
    };

    // Advanced wall detection with edge detection using Sobel operators
    const detectWallAreas = (img) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxAnalysisWidth = 512; // cap processing size for performance
        const scale = Math.min(
            1,
            (canvasRef.current?.parentElement?.clientWidth || 800) / img.width,
            maxAnalysisWidth / img.width
        );
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        
        // Convert to grayscale for edge detection
        const gray = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            const idx = i / 4;
            gray[idx] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }

        // Sobel edge detection to find boundaries
        const edges = new Uint8Array(width * height);
        const edgeStrength = new Float32Array(width * height);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // Sobel kernels
                const gx = 
                    -gray[(y-1)*width + (x-1)] + gray[(y-1)*width + (x+1)] +
                    -2*gray[y*width + (x-1)] + 2*gray[y*width + (x+1)] +
                    -gray[(y+1)*width + (x-1)] + gray[(y+1)*width + (x+1)];
                
                const gy = 
                    -gray[(y-1)*width + (x-1)] - 2*gray[(y-1)*width + x] - gray[(y-1)*width + (x+1)] +
                    gray[(y+1)*width + (x-1)] + 2*gray[(y+1)*width + x] + gray[(y+1)*width + (x+1)];
                
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edgeStrength[idx] = magnitude;
                
                // Mark strong edges (boundaries) - STRICTER threshold to prevent leakage
                if (magnitude > 25) {
                    edges[idx] = 1;
                }
            }
        }

        // Region-grow main wall from central seeds
        const wallMapClean = new Uint8Array(width * height);
        let mainWallComponent = [];

        const getPixel = (idx) => {
            const i = idx * 4;
            return [data[i], data[i + 1], data[i + 2]];
        };

        const colorDiff = (a, b) => {
            return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        };

        const growRegion = (seedX, seedY) => {
            const seedIdx = seedY * width + seedX;
            if (edgeStrength[seedIdx] > 40) return [];
            const seedColor = getPixel(seedIdx);
            const seedBrightness = (seedColor[0] + seedColor[1] + seedColor[2]) / 3;
            if (seedBrightness < 30 || seedBrightness > 240) return [];

            const queue = [seedIdx];
            const visited = new Uint8Array(width * height);
            const region = [];
            visited[seedIdx] = 1;

            const maxPixels = Math.floor(width * height * 0.45);
            const colorTol = 55;

            while (queue.length && region.length < maxPixels) {
                const idx = queue.shift();
                region.push(idx);

                const x = idx % width;
                const y = Math.floor(idx / width);

                const neighbors = [
                    idx - 1,
                    idx + 1,
                    idx - width,
                    idx + width
                ];

                for (const nIdx of neighbors) {
                    const nx = nIdx % width;
                    const ny = Math.floor(nIdx / width);
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                    if (visited[nIdx]) continue;
                    if (edgeStrength[nIdx] > 45) continue;

                    const rgb = getPixel(nIdx);
                    const brightness = (rgb[0] + rgb[1] + rgb[2]) / 3;
                    if (brightness < 30 || brightness > 240) continue;
                    if (colorDiff(rgb, seedColor) > colorTol) continue;

                    visited[nIdx] = 1;
                    queue.push(nIdx);
                }
            }

            return region;
        };

        const seedXs = [0.3, 0.45, 0.6, 0.7].map(r => Math.floor(width * r));
        const seedYs = [0.35, 0.5, 0.6].map(r => Math.floor(height * r));
        let bestRegion = [];

        for (const sy of seedYs) {
            for (const sx of seedXs) {
                const region = growRegion(sx, sy);
                if (region.length > bestRegion.length) {
                    bestRegion = region;
                }
            }
        }

        if (bestRegion.length > Math.floor(width * height * 0.02)) {
            mainWallComponent = bestRegion;
            for (const idx of bestRegion) wallMapClean[idx] = 1;
        }
        let wallContours = [];
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // Check if this is a wall pixel
                if (wallMapClean[idx] === 1) {
                    // Check if any neighbor is NOT a wall (boundary detection)
                    const isTopWall = wallMapClean[(y-1) * width + x] === 1;
                    const isBottomWall = wallMapClean[(y+1) * width + x] === 1;
                    const isLeftWall = wallMapClean[y * width + (x-1)] === 1;
                    const isRightWall = wallMapClean[y * width + (x+1)] === 1;
                    
                    // If any neighbor is not wall, this is a boundary point
                    if (!isTopWall || !isBottomWall || !isLeftWall || !isRightWall) {
                        wallContours.push({ x, y });
                    }
                }
            }
        }

        // Downsample boundary points if too many to avoid UI freeze
        if (wallContours.length > 30000) {
            wallContours = wallContours.filter((_, i) => i % 5 === 0);
        } else if (wallContours.length > 15000) {
            wallContours = wallContours.filter((_, i) => i % 3 === 0);
        }

        // Trace continuous lines from contour points
        const wallBoundaryLines = traceContourLines(wallContours, width, height);

        return { canvas, wallMap: wallMapClean, edges, edgeStrength, wallBoundaryLines, width, height, mainWallComponent };
    };

    // Paint entire wall segment when clicked - SIMPLE COLOR-BASED FLOOD FILL
    const paintWallSegment = (startX, startY, colorHex) => {
        if (!selectedColor) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const startIdx = startY * canvas.width + startX;
        const targetRgb = hexToRgb(colorHex);
        if (!targetRgb) return;

        // NEW CLEAN COATING MECHANISM: Professional paint application
        const visited = new Set();
        const queue = [startIdx];
        let paintedPixels = 0;
        let paintedRegions = 0;

        // Process single region from click point
        visited.add(startIdx);

        while (queue.length > 0) {
            const idx = queue.shift();
            if (!idx && idx !== 0) continue;

            const pos = idx * 4;
            const x = idx % canvas.width;
            const y = Math.floor(idx / canvas.width);

            // Boundary checks
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

            const r = data[pos];
            const g = data[pos + 1];
            const b = data[pos + 2];
            const alpha = data[pos + 3];

            // Skip if already painted or if pixel is transparent
            if (alpha < 200) continue;

            // Apply clean paint coating
            data[pos] = targetRgb.r;
            data[pos + 1] = targetRgb.g;
            data[pos + 2] = targetRgb.b;
            data[pos + 3] = 255; // Full opacity for clean finish
            paintedPixels++;

            // Add adjacent pixels (4-way connectivity for clean edges)
            const neighbors = [idx - 1, idx + 1, idx - canvas.width, idx + canvas.width];
            for (const nIdx of neighbors) {
                if (!visited.has(nIdx)) {
                    const nPos = nIdx * 4;
                    const nX = nIdx % canvas.width;
                    const nY = Math.floor(nIdx / canvas.width);

                    // Boundary check
                    if (nX < 0 || nX >= canvas.width || nY < 0 || nY >= canvas.height) continue;

                    const nR = data[nPos];
                    const nG = data[nPos + 1];
                    const nB = data[nPos + 2];
                    const nA = data[nPos + 3];

                    // Check if neighbor should be painted
                    if (nA >= 200) { // Not transparent
                        visited.add(nIdx);
                        queue.push(nIdx);
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        console.log(`🎨 CLEAN PAINT COATING APPLIED: ${paintedPixels} pixels with professional finish`);
    };

    const paintAllWalls = (colorHex) => {
        if (!wallBoundaryCanvas || !selectedColor) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const targetRgb = hexToRgb(colorHex);
        if (!targetRgb) return;

        // NEW CLEAN COATING MECHANISM: Professional wall painting
        let paintedPixels = 0;
        const width = canvas.width;
        const height = canvas.height;

        // Step 1: Identify all paintable regions in walls
        const visited = new Set();
        const regions = [];

        for (let idx = 0; idx < wallBoundaryCanvas.wallMap.length; idx++) {
            if (wallBoundaryCanvas.wallMap[idx] !== 1 || visited.has(idx)) continue;

            // Start new region
            const region = [];
            const queue = [idx];
            visited.add(idx);

            // Flood fill to find connected wall region
            while (queue.length > 0) {
                const pixIdx = queue.shift();
                if (!pixIdx && pixIdx !== 0) continue;

                const pixPos = pixIdx * 4;
                const x = pixIdx % width;
                const y = Math.floor(pixIdx / width);

                // Bounds check
                if (x < 0 || x >= width || y < 0 || y >= height) continue;

                // Skip if not wall
                if (wallBoundaryCanvas.wallMap[pixIdx] !== 1) continue;

                region.push(pixIdx);

                // Add neighbors
                const neighbors = [pixIdx - 1, pixIdx + 1, pixIdx - width, pixIdx + width];
                for (const nIdx of neighbors) {
                    if (!visited.has(nIdx)) {
                        const nX = nIdx % width;
                        const nY = Math.floor(nIdx / width);
                        if (nX >= 0 && nX < width && nY >= 0 && nY < height) {
                            if (wallBoundaryCanvas.wallMap[nIdx] === 1) {
                                visited.add(nIdx);
                                queue.push(nIdx);
                            }
                        }
                    }
                }
            }

            if (region.length > 0) {
                regions.push(region);
            }
        }

        // Step 2: Apply clean paint coating to all regions
        for (const region of regions) {
            for (const pixIdx of region) {
                const pixPos = pixIdx * 4;
                const alpha = data[pixPos + 3];

                // Only paint opaque pixels
                if (alpha >= 200) {
                    data[pixPos] = targetRgb.r;
                    data[pixPos + 1] = targetRgb.g;
                    data[pixPos + 2] = targetRgb.b;
                    data[pixPos + 3] = 255;
                    paintedPixels++;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        console.log(`🎨 PROFESSIONAL PAINT COATING: ${paintedPixels} pixels applied in ${regions.length} wall regions - CLEAN & NEAT`);
    };

    const getWallRegionFromSeed = (seedX, seedY) => {
        if (!wallBoundaryCanvas) return [];
        const canvas = canvasRef.current;
        if (!canvas) return [];

        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const seedIdx = seedY * width + seedX;
        const seedPos = seedIdx * 4;
        const seedColor = [data[seedPos], data[seedPos + 1], data[seedPos + 2]];
        const seedBrightness = (seedColor[0] + seedColor[1] + seedColor[2]) / 3;

        if (seedBrightness < 30 || seedBrightness > 240) return [];
        if (wallBoundaryCanvas.edgeStrength?.[seedIdx] > 45) return [];

        const colorDiff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        const visited = new Uint8Array(width * height);
        const queue = [seedIdx];
        const region = [];
        const maxPixels = Math.floor(width * height * 0.45);
        const colorTol = 60;

        visited[seedIdx] = 1;

        while (queue.length && region.length < maxPixels) {
            const idx = queue.shift();
            region.push(idx);

            const x = idx % width;
            const y = Math.floor(idx / width);

            const neighbors = [
                idx - 1,
                idx + 1,
                idx - width,
                idx + width
            ];

            for (const nIdx of neighbors) {
                const nx = nIdx % width;
                const ny = Math.floor(nIdx / width);
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                if (visited[nIdx]) continue;
                if (wallBoundaryCanvas.edgeStrength?.[nIdx] > 45) continue;

                const pos = nIdx * 4;
                const rgb = [data[pos], data[pos + 1], data[pos + 2]];
                const brightness = (rgb[0] + rgb[1] + rgb[2]) / 3;
                if (brightness < 30 || brightness > 240) continue;
                if (colorDiff(rgb, seedColor) > colorTol) continue;

                visited[nIdx] = 1;
                queue.push(nIdx);
            }
        }

        return region;
    };

    // Get available brands dynamically based on current paintType
    const availableBrands = useMemo(() => {
        const typeData = paintDatabase[paintType];
        if (!typeData) return [];
        const allColors = colorTones.flatMap(tone => typeData[tone] || []);
        const brands = new Set(allColors.map(c => c.brand));
        return Array.from(brands).sort();
    }, [paintType]);

    // Flatten or filter colors based on type, tone, and brand
    const filteredColors = useMemo(() => {
        const typeData = paintDatabase[paintType];
        if (!typeData) return [];

        let colors = [];
        if (selectedTone === 'all') {
            // Combine all arrays into one big list
            colors = colorTones.flatMap(tone => typeData[tone] || []);
        } else {
            colors = typeData[selectedTone] || [];
        }

        if (selectedBrand !== 'all') {
            colors = colors.filter(c => c.brand === selectedBrand);
        }

        return colors;
    }, [paintType, selectedTone, selectedBrand]);

    // Set default color when list changes
    useMemo(() => {
        if (filteredColors.length > 0 && (!selectedColor || !filteredColors.includes(selectedColor))) {
            setSelectedColor(filteredColors[0]);
        } else if (filteredColors.length === 0) {
            setSelectedColor(null);
        }
    }, [filteredColors]);

    const drawImage = (img) => {
        console.log("drawImage called with image:", img);
        const canvas = canvasRef.current;
        if (!canvas) {
            console.log("Canvas not found");
            return;
        }
        const ctx = canvas.getContext('2d');
        console.log("Canvas context:", ctx);

        // Scale to fit wrapper
        const containerWidth = canvas.parentElement.clientWidth || 800; // Fallback width
        const scale = Math.min(1, containerWidth / img.width);
        console.log("Scale:", scale, "Container width:", containerWidth, "Image width:", img.width);

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        console.log("Canvas size set to:", canvas.width, "x", canvas.height);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        console.log("Image drawn to canvas");

        // Detect wall areas
        const wallData = detectWallAreas(img);
        setWallBoundaryCanvas(wallData);
        console.log("Wall detection completed");
    };

    // Draw image when it changes and canvas is ready
    useEffect(() => {
        if (image && canvasRef.current) {
            // Short timeout to ensure DOM layout is settled
            setTimeout(() => drawImage(image), 50);
        }
    }, [image]);

    useEffect(() => {
        if (!wallMask || !canvasRef.current) {
            wallMaskMapRef.current = null;
            return;
        }

        const canvas = canvasRef.current;
        const temp = document.createElement('canvas');
        const tctx = temp.getContext('2d');
        temp.width = canvas.width;
        temp.height = canvas.height;
        tctx.drawImage(wallMask, 0, 0, temp.width, temp.height);

        const maskData = tctx.getImageData(0, 0, temp.width, temp.height).data;
        const maskMap = new Uint8Array(temp.width * temp.height);

        for (let i = 0; i < maskMap.length; i++) {
            const pos = i * 4;
            const r = maskData[pos];
            const g = maskData[pos + 1];
            const b = maskData[pos + 2];
            const a = maskData[pos + 3];
            const brightness = (r + g + b) / 3;
            if (a > 10 && brightness > 160) {
                maskMap[i] = 1;
            }
        }

        wallMaskMapRef.current = maskMap;
    }, [wallMask, image]);

    // Auto paint walls when a user selects a color tone (or specific color)
    useEffect(() => {
        if (!image || !selectedColor || !wallBoundaryCanvas) return;
        if (toolMode !== 'wallFill') return;

        const paintKey = `${image.src || 'image'}|${selectedColor.code}`;
        if (lastAutoPaintRef.current === paintKey) return;
        lastAutoPaintRef.current = paintKey;

        drawImage(image);
        setTimeout(() => paintAllWalls(selectedColor.hex), 80);
    }, [selectedColor, image, wallBoundaryCanvas, toolMode]);

    // Load default image on component mount
    useEffect(() => {
        if (!imageLoaded) {
            const img = new Image();
            img.onload = () => {
                setImage(img);
                setImageLoaded(true);
                // Auto-analyze the image
                setTimeout(() => {
                    analyzeImage(img);
                }, 100);
            };
            img.onerror = () => {
                console.error("Failed to load default wall image");
                setImageLoaded(true);
            };
            img.src = wallImageDefault;
        }
    }, []);

    // --- ADVANCED IMAGE PROCESSING ---

    // Placeholder for AI API connection
    const fetchSegmentationMask = async (imageDataBase64) => {
        // TODO: Connect to Hugging Face / Replicate API here
        // Example: const response = await fetch('https://api-inference.huggingface.co/models/nvidia/segformer-b0-finetuned-ade-20k-512-512', ...)
        console.log("Connecting to AI Segmentation API... (Placeholder)");
        return null;
    };

    const analyzeImage = async (img) => {
        setAnalyzing(true);
        setAnalysisResult(null);

        try {
            // Convert image to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

            // Call Groq Vision API
            console.log("🔄 Calling Groq Vision API for wall analysis...");
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.2-90b-vision-preview",
                    messages: [{
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze this image and answer: 1) Is this a building/wall structure? (yes/no) 2) Is it an interior or exterior wall? Answer in JSON format: {\"isBuilding\": true/false, \"type\": \"interior\" or \"exterior\"}"
                            },
                            {
                                type: "image_url",
                                image_url: { url: imageDataUrl }
                            }
                        ]
                    }],
                    temperature: 0.1,
                    max_tokens: 100
                })
            });

            const data = await response.json();
            console.log("✅ Groq API Response:", data);

            if (data.error) {
                console.error("❌ Groq API Error:", data.error);
                throw new Error(data.error.message || "API Error");
            }

            const aiResponse = data.choices[0].message.content;

            // Parse AI response
            let detectedType = 'interior';
            let isBuilding = true;

            try {
                const parsed = JSON.parse(aiResponse);
                isBuilding = parsed.isBuilding;
                detectedType = parsed.type.toLowerCase();
            } catch (e) {
                // Fallback: simple text parsing
                if (aiResponse.toLowerCase().includes('exterior')) {
                    detectedType = 'exterior';
                } else if (aiResponse.toLowerCase().includes('interior')) {
                    detectedType = 'interior';
                }
                isBuilding = !aiResponse.toLowerCase().includes('not a building');
            }

            setPaintType(detectedType);
            setAnalysisResult({
                verified: isBuilding,
                type: detectedType,
                message: isBuilding
                    ? `AI Verified: ${detectedType.charAt(0).toUpperCase() + detectedType.slice(1)} Wall Detected`
                    : "Warning: No clear wall structure detected"
            });

            // Fetch wall segmentation mask from Hugging Face for precise painting
            if (isBuilding) {
                try {
                    console.log("🔄 Calling HuggingFace API for wall segmentation...");
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));

                    const hfResponse = await fetch(
                        "https://api-inference.huggingface.co/models/segments/segformer-b0-finetuned-ade-512-512",
                        {
                            headers: {
                                Authorization: `Bearer ${import.meta.env.VITE_HF_API_KEY}`,
                                Accept: "application/json"
                            },
                            method: "POST",
                            body: blob,
                        }
                    );

                    if (hfResponse.ok) {
                        const contentType = hfResponse.headers.get('content-type') || '';
                        if (contentType.includes('application/json')) {
                            const segments = await hfResponse.json();

                            const containerWidth = canvasRef.current?.parentElement?.clientWidth || img.width;
                            const scale = Math.min(1, containerWidth / img.width);
                            const targetWidth = Math.max(1, Math.round(img.width * scale));
                            const targetHeight = Math.max(1, Math.round(img.height * scale));

                            const maskMap = await buildMaskMapFromSegments(segments, targetWidth, targetHeight);
                            if (maskMap && maskMap.length === targetWidth * targetHeight) {
                                wallMaskMapRef.current = maskMap;
                                console.log("✅ Wall segmentation mask map loaded from HuggingFace");
                            } else {
                                console.log("⚠️ HF segmentation returned no usable wall mask");
                            }
                        } else if (contentType.startsWith('image/')) {
                            const segmentationData = await hfResponse.blob();
                            const maskImg = new Image();
                            maskImg.src = URL.createObjectURL(segmentationData);
                            maskImg.onload = () => {
                                setWallMask(maskImg);
                                console.log("✅ Wall segmentation mask loaded from HuggingFace (image)");
                            };
                        } else {
                            console.log("⚠️ HuggingFace API returned unsupported content-type:", contentType);
                        }
                    } else {
                        console.log("⚠️ HuggingFace API returned status:", hfResponse.status);
                    }
                } catch (hfError) {
                    console.log("⚠️ HF Segmentation skipped (using local edge detection):", hfError.message);
                }
            }

        } catch (error) {
            console.error("AI Analysis failed:", error);

            // Fallback to basic sky detection
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 200;
            ctx.drawImage(img, 0, 0, 200, 200);

            const imageData = ctx.getImageData(0, 0, 200, 200);
            const data = imageData.data;

            let skyPixels = 0;
            const topSectionLimit = (data.length / 4) * 0.3;

            for (let i = 0; i < topSectionLimit * 4; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Blue sky
                if (b > r + 20 && b > g + 10 && b > 100) {
                    skyPixels++;
                }
                // White/Overcast sky (common in construction photos)
                else if (r > 180 && g > 180 && b > 180 && Math.abs(r - g) < 30 && Math.abs(r - b) < 30) {
                    skyPixels++;
                }
            }

            const skyRatio = skyPixels / topSectionLimit;
            const isExterior = skyRatio > 0.10; // Lowered threshold for better detection
            const detectedType = isExterior ? 'exterior' : 'interior';

            setPaintType(detectedType);
            setAnalysisResult({
                verified: true,
                type: detectedType,
                message: `Detected: ${detectedType.charAt(0).toUpperCase() + detectedType.slice(1)} (Fallback Mode)`
            });
        } finally {
            setAnalyzing(false);
        }
    };

    const onDrop = (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    wallMaskMapRef.current = null;
                    setWallMask(null);
                    setImage(img);
                    analyzeImage(img);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };

    // Color conversion helpers
    const rgbToHsl = (r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, l];
    };

    const hslToRgb = (h, s, l) => {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    };

    const handleCanvasClick = (e) => {
        if (!image || !selectedColor) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(e.clientX - rect.left);
        const y = Math.floor(e.clientY - rect.top);

        requestAnimationFrame(() => {
            if (wallMaskMapRef.current && wallMaskMapRef.current.length === canvas.width * canvas.height) {
                paintAllWalls(selectedColor.hex);
                return;
            }

            const region = getWallRegionFromSeed(x, y);
            if (region.length > 0) {
                setWallBoundaryCanvas(prev => prev ? { ...prev, mainWallComponent: region, wallMap: prev.wallMap } : prev);
                paintAllWalls(selectedColor.hex);
            } else {
                paintWallSegment(x, y, selectedColor.hex);
            }
        });
    };

    const handleReset = () => {
        if (image) drawImage(image);
        setAnalysisResult(null);
    };
    
    const undoLastStroke = () => {
        if (image) drawImage(image);
    };

    const togglePaintType = (type) => {
        setPaintType(type);
        setSelectedTone('all');
        setSelectedBrand('all');
    };

    return (
        <div className={styles.visualizerPage}>
            <div className="container">
                <h1 className="title-gradient">{t('visualizer.title')}</h1>
                <p className={styles.instruction}>{image ? t('visualizer.instruction') : t('visualizer.upload')}</p>

                <div className={styles.workspace}>
                    {/* Sidebar */}
                    <div className={styles.sidebar}>
                        <div className={styles.sidebarContent}>
                            <div className={styles.typeSelector}>
                                <button
                                    className={`${styles.typeBtn} ${paintType === 'interior' ? styles.activeType : ''}`}
                                    onClick={() => togglePaintType('interior')}
                                >
                                    <HomeIcon size={18} /> Interior
                                </button>
                                <button
                                    className={`${styles.typeBtn} ${paintType === 'exterior' ? styles.activeType : ''}`}
                                    onClick={() => togglePaintType('exterior')}
                                >
                                    <Layers size={18} /> Exterior
                                </button>
                            </div>

                            <h3>Select Tone (VIBGYOR)</h3>
                            <div className={styles.toneSelector}>
                                <button className={`${styles.toneBtn} ${selectedTone === 'all' ? styles.activeTone : ''}`} onClick={() => setSelectedTone('all')}>All</button>
                                {colorTones.map(tone => (
                                    <button
                                        key={tone}
                                        className={`${styles.toneBtn} ${selectedTone === tone ? styles.activeTone : ''}`}
                                        onClick={() => setSelectedTone(tone)}
                                        style={{ textTransform: 'capitalize' }}
                                    >
                                        {tone}
                                    </button>
                                ))}
                            </div>

                            <h3>Select Brand</h3>
                            <div className={styles.brandSelector}>
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
                            </div>

                            <h3>Wall Painting Mode</h3>
                            <div className={styles.toolSelector}>
                                <button 
                                    className={`${styles.toolBtn} ${toolMode === 'wallFill' ? styles.activeTool : ''}`}
                                    onClick={() => setToolMode('wallFill')}
                                    title="Wall Fill - Click on any wall to paint the entire wall segment"
                                >
                                    <Layers size={16} /> Wall Fill
                                </button>
                            </div>

                            <div className={styles.toolSelector} style={{ marginTop: '0.5rem' }}>
                                <button 
                                    className={`${styles.toolBtn} ${showWallBoundary ? styles.activeTool : ''}`}
                                    onClick={() => setShowWallBoundary(!showWallBoundary)}
                                    title="Toggle wall boundary visualization"
                                >
                                    {showWallBoundary ? <Eye size={16} /> : <EyeOff size={16} />} 
                                    {showWallBoundary ? ' Hide' : ' Show'} Boundaries
                                </button>
                            </div>
                            
                            <div className={styles.instructionBox}>
                                <p><strong>How to use:</strong></p>
                                <p>1. Select a paint color below</p>
                                <p>2. Click on any wall in the image</p>
                                <p>3. The entire wall segment will be painted</p>
                                <p>4. Try different colors on different walls</p>
                            </div>

                            <h3 style={{ marginTop: '1.5rem' }}>
                                {filteredColors.length} Colors Found
                            </h3>
                            <div className={styles.colorGridWrapper}>
                                {availableBrands.filter(b => selectedBrand === 'all' || selectedBrand === b).map(brand => {
                                    const brandColors = filteredColors.filter(c => c.brand === brand);
                                    if (brandColors.length === 0) return null;
                                    return (
                                        <div key={brand} className={styles.brandSection}>
                                            <h4 className={styles.brandTitle}>{brand}</h4>
                                            <div className={styles.colorGrid}>
                                                {brandColors.map(c => (
                                                    <div
                                                        key={c.code}
                                                        className={styles.colorItem}
                                                        onClick={() => setSelectedColor(c)}
                                                    >
                                                        <div
                                                            className={`${styles.colorChip} ${selectedColor?.code === c.code ? styles.activeChip : ''}`}
                                                            style={{ backgroundColor: c.hex }}
                                                            title={`${c.name} (${c.brand})`}
                                                        />
                                                        <span className={styles.colorCode}>{c.code}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredColors.length === 0 && (
                                    <p className={styles.noColors}>No colors found for this selection.</p>
                                )}
                            </div>

                            {selectedColor && (
                                <div className={styles.selectedInfo}>
                                    <div className={styles.swatch} style={{ background: selectedColor.hex }}></div>
                                    <div className={styles.details}>
                                        <strong>{selectedColor.name}</strong>
                                        <small>{selectedColor.brand} | {selectedColor.code}</small>
                                    </div>
                                </div>
                            )}

                            <button className={styles.resetBtn} onClick={handleReset}>
                                <RefreshCw size={16} /> {t('visualizer.reset')}
                            </button>
                        </div>
                    </div>

                    {/* Main Area */}
                    <div className={styles.mainArea}>
                        {!image ? (
                            <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.dragActive : ''}`}>
                                <input {...getInputProps()} />
                                <Upload size={48} className={styles.uploadIcon} />
                                <p>{t('visualizer.drag')} or use Camera</p>
                                <small style={{ color: 'var(--text-muted)' }}>Supports JPG, PNG, and Mobile Camera</small>
                            </div>
                        ) : (
                            <div className={styles.canvasWrapper}>
                                <div className={styles.canvasContainer}>
                                    <canvas
                                        ref={canvasRef}
                                        className={styles.canvas}
                                        onClick={handleCanvasClick}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    {showWallBoundary && wallBoundaryCanvas && wallBoundaryCanvas.wallBoundaryLines && (
                                        <div className={styles.boundaryOverlay}>
                                            <svg 
                                                width={canvasRef.current?.width} 
                                                height={canvasRef.current?.height} 
                                                className={styles.boundaryLayer}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                <defs>
                                                    <filter id="phantomGlow">
                                                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                                        <feMerge>
                                                            <feMergeNode in="coloredBlur"/>
                                                            <feMergeNode in="SourceGraphic"/>
                                                        </feMerge>
                                                    </filter>
                                                </defs>
                                                <text x="50%" y="20" textAnchor="middle" className={styles.boundaryLabel}>
                                                    Wall Boundaries Detected ✓
                                                </text>
                                                <text x="50%" y="38" textAnchor="middle" className={styles.boundarySubLabel}>
                                                    {wallBoundaryCanvas.wallBoundaryLines.length} wall segments • Click to paint
                                                </text>
                                                {/* Draw phantom lines around wall edges and corners */}
                                                {wallBoundaryCanvas.wallBoundaryLines.map((line, lineIndex) => {
                                                    if (line.length < 2) return null;
                                                    
                                                    // Create SVG path from points
                                                    const pathData = line.map((point, idx) => 
                                                        `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
                                                    ).join(' ');
                                                    
                                                    return (
                                                        <path
                                                            key={lineIndex}
                                                            d={pathData}
                                                            fill="none"
                                                            stroke="#22D3EE"
                                                            strokeWidth="1.5"
                                                            strokeOpacity="0.7"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            filter="url(#phantomGlow)"
                                                        />
                                                    );
                                                })}
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                {analyzing && (
                                    <div className={styles.analysisOverlay}>
                                        <div className={styles.scanner}></div>
                                        <p>Analyzing Structure...</p>
                                    </div>
                                )}
                                {analysisResult && !analyzing && (
                                    <div className={styles.analysisResult}>
                                        <div className={styles.resultBadge}>
                                            {analysisResult.message}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Visualizer;
