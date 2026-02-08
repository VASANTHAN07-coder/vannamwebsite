// Clean flood fill algorithm for wall painting
export const floodFill = (canvas, startX, startY, targetColor, tolerance) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Get starting pixel color
    const startIdx = startY * canvas.width + startX;
    const startPos = startIdx * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startBrightness = (startR + startG + startB) / 3;

    // Skip dark/bright areas (windows, doors, frames)
    if (startBrightness < 25 || startBrightness > 245) {
        return 0;
    }

    // BFS flood fill
    const visited = new Uint8Array(canvas.width * canvas.height);
    const queue = [[startX, startY]];
    let paintedPixels = 0;
    const maxPixels = 500000;

    visited[startIdx] = 1;

    while (queue.length > 0 && paintedPixels < maxPixels) {
        const [x, y] = queue.shift();

        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

        const idx = y * canvas.width + x;
        if (visited[idx]) continue;

        const pos = idx * 4;
        const r = data[pos];
        const g = data[pos + 1];
        const b = data[pos + 2];
        const brightness = (r + g + b) / 3;

        // Skip windows/doors/frames
        if (brightness < 25 || brightness > 245) {
            visited[idx] = 1;
            continue;
        }

        // Check color similarity to original
        const colorDiff = Math.abs(r - startR) + Math.abs(g - startG) + Math.abs(b - startB);
        if (colorDiff > tolerance) {
            visited[idx] = 1;
            continue;
        }

        visited[idx] = 1;
        paintedPixels++;

        // Apply color
        data[pos] = targetColor.r;
        data[pos + 1] = targetColor.g;
        data[pos + 2] = targetColor.b;

        // Add 4-way neighbors
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
    return paintedPixels;
};
