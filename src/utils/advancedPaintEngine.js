/**
 * Advanced Paint Visualization Engine - FINAL VERSION
 * 
 * Professional-grade paint application system
 * NO EXTERNAL APIs NEEDED - 100% Local Processing
 * 
 * Features:
 * - Realistic lighting preservation
 * - Texture-aware color application
 * - Professional edge blending
 * - Zero API dependencies
 */

/**
 * LIGHTING & DEPTH ANALYSIS
 * Extract and preserve natural shadows, highlights, and texture
 */
export function analyzeLighting(imageData, width, height) {
    const data = imageData.data;
    const totalPixels = width * height;

    const lightingMap = new Float32Array(totalPixels);
    const depthMap = new Float32Array(totalPixels);
    const shadowMask = new Uint8Array(totalPixels);
    const highlightMask = new Uint8Array(totalPixels);
    const textureMap = new Float32Array(totalPixels);

    if (totalPixels === 0) {
        return { 
            lightingMap, 
            depthMap, 
            shadowMask, 
            highlightMask, 
            textureMap, 
            sunDirection: { x: 0, y: 0 }, 
            stats: { mean: 0, std: 0 } 
        };
    }

    let luminanceSum = 0;
    let luminanceSqSum = 0;

    // Calculate per-pixel brightness
    for (let i = 0; i < totalPixels; i++) {
        const pos = i * 4;
        const r = data[pos];
        const g = data[pos + 1];
        const b = data[pos + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        lightingMap[i] = luminance / 255;
        luminanceSum += luminance;
        luminanceSqSum += luminance * luminance;
    }

    const meanLum = luminanceSum / totalPixels;
    const variance = Math.max(luminanceSqSum / totalPixels - meanLum * meanLum, 0);
    const stdLum = Math.sqrt(variance);
    const normalizedMean = meanLum / 255;
    const normalizedStd = stdLum / 255;

    let gradXTotal = 0;
    let gradYTotal = 0;

    // Calculate gradients, depth, texture, shadows, highlights
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const luminance = lightingMap[idx] * 255;

            const up = lightingMap[(y - 1) * width + x] * 255;
            const down = lightingMap[(y + 1) * width + x] * 255;
            const left = lightingMap[y * width + (x - 1)] * 255;
            const right = lightingMap[y * width + (x + 1)] * 255;

            const gx = -left + right;
            const gy = -up + down;

            gradXTotal += gx;
            gradYTotal += gy;

            const gradMagnitude = Math.sqrt(gx * gx + gy * gy);
            depthMap[idx] = clamp(gradMagnitude / 510, 0, 1);

            // Calculate local texture variance
            const neighborhood = [
                lightingMap[(y - 1) * width + (x - 1)],
                lightingMap[(y - 1) * width + x],
                lightingMap[(y - 1) * width + (x + 1)],
                lightingMap[y * width + (x - 1)],
                lightingMap[idx],
                lightingMap[y * width + (x + 1)],
                lightingMap[(y + 1) * width + (x - 1)],
                lightingMap[(y + 1) * width + x],
                lightingMap[(y + 1) * width + (x + 1)]
            ];
            const localMean = neighborhood.reduce((acc, val) => acc + val, 0) / neighborhood.length;
            const localVar = neighborhood.reduce((acc, val) => acc + (val - localMean) * (val - localMean), 0) / neighborhood.length;
            textureMap[idx] = clamp(Math.sqrt(localVar) * 2, 0, 1);

            // Mark shadows and highlights
            if (luminance < meanLum - stdLum * 0.6) shadowMask[idx] = 1;
            if (luminance > meanLum + stdLum * 0.6) highlightMask[idx] = 1;
        }
    }

    // Calculate sun direction
    const sunVector = (() => {
        const length = Math.sqrt(gradXTotal * gradXTotal + gradYTotal * gradYTotal) || 1;
        return {
            x: -gradXTotal / length,
            y: -gradYTotal / length
        };
    })();

    return {
        lightingMap,
        depthMap,
        shadowMask,
        highlightMask,
        textureMap,
        sunDirection: sunVector,
        stats: {
            mean: normalizedMean,
            std: normalizedStd
        }
    };
}

/**
 * COLOR APPLICATION WITH LIGHTING PRESERVATION
 * Apply user-selected color ONLY to wall areas while preserving shadows/highlights
 * OPTIMIZED FOR SMOOTH, UNIFORM COVERAGE WITH NO LINES
 */
export function applyRealisticPaint(imageData, wallMask, targetColor, lightingInfo, width, height, options = {}) {
    const data = imageData.data;
    if (!wallMask || wallMask.length === 0) return 0;

    const totalPixels = Math.min(wallMask.length, width * height);

    const targetRgb = hexToRgb(targetColor);
    if (!targetRgb) return 0;

    const lightingMap = lightingInfo?.lightingMap;
    const shadowMask = lightingInfo?.shadowMask;
    const highlightMask = lightingInfo?.highlightMask;
    const depthMap = lightingInfo?.depthMap;

    const contextCondition = (lightingInfo?.surfaceCondition || options.surfaceCondition || 'clean').toLowerCase();
    const contextType = (lightingInfo?.wallType || options.wallType || 'exterior').toLowerCase();

    // Surface condition affects opacity - maximize coverage
    const conditionConfig = {
        clean: { overlay: 0.95 },
        dusty: { overlay: 0.94 },
        stained: { overlay: 0.93 },
        unfinished: { overlay: 0.92 }
    }[contextCondition] || { overlay: 0.95 };

    const wallTypeBias = contextType === 'interior' ? 0.01 : -0.02;

    let paintedPixels = 0;

    // First pass: Apply base paint color uniformly
    for (let i = 0; i < totalPixels; i++) {
        if (wallMask[i] !== 1) continue;

        const pos = i * 4;
        const originalR = data[pos];
        const originalG = data[pos + 1];
        const originalB = data[pos + 2];

        // Get base luminance for lighting preservation
        let luminance = lightingMap 
            ? lightingMap[i] 
            : (0.299 * originalR + 0.587 * originalG + 0.114 * originalB) / 255;

        luminance = clamp(luminance + wallTypeBias, 0, 1);

        // Subtle shadow/highlight preservation - NOT TOO STRONG
        if (shadowMask && shadowMask[i]) {
            luminance = clamp(luminance * 0.96, 0, 1);
        }
        if (highlightMask && highlightMask[i]) {
            luminance = clamp(luminance * 1.02 + 0.01, 0, 1);
        }
        if (depthMap) {
            luminance = clamp(luminance * (1 - depthMap[i] * 0.04), 0, 1);
        }

        // Apply selected color with luminance adjustment
        const lightAdjustedR = targetRgb.r * luminance;
        const lightAdjustedG = targetRgb.g * luminance;
        const lightAdjustedB = targetRgb.b * luminance;

        // Strong overlay for uniform finish
        const overlayStrength = conditionConfig.overlay;
        data[pos] = Math.round(clamp(lightAdjustedR * overlayStrength + originalR * (1 - overlayStrength), 0, 255));
        data[pos + 1] = Math.round(clamp(lightAdjustedG * overlayStrength + originalG * (1 - overlayStrength), 0, 255));
        data[pos + 2] = Math.round(clamp(lightAdjustedB * overlayStrength + originalB * (1 - overlayStrength), 0, 255));
        data[pos + 3] = 255;

        paintedPixels++;
    }

    return paintedPixels;
}

/**
 * EDGE BLENDING
 * Smooth transitions at wall boundaries - eliminates harsh lines
 */
export function blendEdges(imageData, wallMask, width, height) {
    if (!wallMask) return;
    
    const data = imageData.data;
    const blendRadius = 3;  // Increased for smoother blending

    // Find edge pixels
    const edgePixels = [];
    for (let y = blendRadius; y < height - blendRadius; y++) {
        for (let x = blendRadius; x < width - blendRadius; x++) {
            const idx = y * width + x;
            if (wallMask[idx] === 1) {
                let isEdge = false;
                
                // Check if any neighbor is outside the wall
                for (let dy = -1; dy <= 1 && !isEdge; dy++) {
                    for (let dx = -1; dx <= 1 && !isEdge; dx++) {
                        if (wallMask[(y+dy)*width + (x+dx)] === 0) {
                            isEdge = true;
                        }
                    }
                }
                
                if (isEdge) edgePixels.push(idx);
            }
        }
    }

    // Smooth blend at edges
    const temp = new Uint8ClampedArray(data);
    for (const idx of edgePixels) {
        const x = idx % width;
        const y = Math.floor(idx / width);
        const pos = idx * 4;

        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumWeight = 0;

        // Sample surrounding pixels with gaussian-like weights
        for (let dy = -blendRadius; dy <= blendRadius; dy++) {
            for (let dx = -blendRadius; dx <= blendRadius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    const nPos = nIdx * 4;
                    
                    // Weight based on distance - closer pixels have more weight
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const weight = wallMask[nIdx] === 1 
                        ? (1 - dist / (blendRadius + 1)) 
                        : (1 - dist / (blendRadius + 1)) * 0.5;
                    
                    sumR += temp[nPos] * weight;
                    sumG += temp[nPos + 1] * weight;
                    sumB += temp[nPos + 2] * weight;
                    sumWeight += weight;
                }
            }
        }

        if (sumWeight === 0) continue;

        const blendedR = sumR / sumWeight;
        const blendedG = sumG / sumWeight;
        const blendedB = sumB / sumWeight;

        const blendFactor = 0.4;  // Increased for smoother transition
        data[pos] = Math.round(clamp(data[pos] * (1 - blendFactor) + blendedR * blendFactor, 0, 255));
        data[pos + 1] = Math.round(clamp(data[pos + 1] * (1 - blendFactor) + blendedG * blendFactor, 0, 255));
        data[pos + 2] = Math.round(clamp(data[pos + 2] * (1 - blendFactor) + blendedB * blendFactor, 0, 255));
    }
}

// ==================== HELPER FUNCTIONS ====================

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function clamp(value, min, max) {
    if (Number.isNaN(value)) return min;
    return value < min ? min : value > max ? max : value;
}