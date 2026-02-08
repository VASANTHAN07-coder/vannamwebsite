// Helper to generate realistic color codes per brand
const brands = ['Asian Paints', 'Dulux', 'Nippon', 'Berger', 'Sherwin Williams'];
const tones = ['violet', 'indigo', 'blue', 'green', 'yellow', 'orange', 'red', 'neutral'];

// Base HSL values for tones (Hue, Saturation, Lightness)
const baseHues = {
    violet: { hMin: 260, hMax: 290, sRange: [20, 95], lRange: [15, 95] },
    indigo: { hMin: 230, hMax: 259, sRange: [30, 100], lRange: [10, 65] },
    blue: { hMin: 190, hMax: 229, sRange: [20, 100], lRange: [15, 95] },
    green: { hMin: 80, hMax: 160, sRange: [20, 95], lRange: [15, 95] },
    yellow: { hMin: 40, hMax: 79, sRange: [40, 100], lRange: [40, 98] },
    orange: { hMin: 15, hMax: 39, sRange: [50, 100], lRange: [40, 95] },
    red: { hMin: 345, hMax: 14, sRange: [40, 100], lRange: [20, 95] },
    neutral: { hMin: 0, hMax: 360, sRange: [0, 15], lRange: [5, 98] },
};

const adjectives = ['Soft', 'Deep', 'Royal', 'Pale', 'Vibrant', 'Dark', 'Light', 'Mystic', 'Ocean', 'Forest', 'Sun', 'Night', 'Pure', 'Wild', 'Urban', 'Electric', 'Pastel', 'Rich', 'Dusty', 'Neon', 'Cool', 'Warm', 'Fresh', 'Vintage', 'Cosmic', 'Tranquil'];
const nouns = {
    violet: ['Lavender', 'Orchid', 'Plum', 'Amethyst', 'Lilac', 'Mauve', 'Berry', 'Grape', 'Iris', 'Heather', 'Thistle'],
    indigo: ['Indigo', 'Midnight', 'Ink', 'Twilight', 'Denim', 'Night', 'Storm', 'Space', 'Abyss', 'Galaxy'],
    blue: ['Sky', 'Ocean', 'Mist', 'Azure', 'Cobalt', 'Sapphire', 'Teal', 'Aqua', 'Ice', 'River', 'Steel', 'Lagoon', 'Frost'],
    green: ['Leaf', 'Emerald', 'Grass', 'Pine', 'Sage', 'Mint', 'Lime', 'Fern', 'Olive', 'Jade', 'Moss', 'Jungle', 'Basil'],
    yellow: ['Sun', 'Lemon', 'Gold', 'Cream', 'Daisy', 'Buttercup', 'Sand', 'Corn', 'Honey', 'Banana', 'Amber', 'Citron'],
    orange: ['Sunset', 'Peach', 'Apricot', 'Coral', 'Amber', 'Tangerine', 'Clay', 'Fire', 'Spice', 'Melon', 'Saffron', 'Copper'],
    red: ['Rose', 'Berry', 'Crimson', 'Ruby', 'Brick', 'Scarlet', 'Cherry', 'Mars', 'Wine', 'Blush', 'Rust', 'Candy', 'Chili'],
    neutral: ['White', 'Grey', 'Silver', 'Charcoal', 'Slate', 'Stone', 'Ash', 'Snow', 'Cloud', 'Smoke', 'Pebble', 'Graphite', 'Dove']
};

const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

// Realistic Code Generator per Brand
const generateCode = (brand, index, h, s, l) => {
    if (brand === 'Asian Paints') {
        // 4 digit numeric (e.g., 0234, 7890) or X-YYY format
        // Simple 4 digit padded
        return String(Math.floor(Math.random() * 9000) + 1000);
    } else if (brand === 'Dulux') {
        // Format: 10BB 55/123
        const hueLetter = 'RYBGGYRNN'.charAt(Math.floor(h / 40));
        const subLetter = 'RYBGGYRNN'.charAt(Math.floor((h + 20) / 40));
        const hueNum = Math.floor(Math.random() * 90) + 10;
        const val1 = Math.floor(Math.random() * 80) + 10;
        const val2 = Math.floor(Math.random() * 300) + 100;
        return `${hueNum}${hueLetter}${subLetter} ${val1}/${val2}`;
    } else if (brand === 'Nippon') {
        // Format: NP BGG 1234 P
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const l1 = letters.charAt(Math.floor(Math.random() * 26));
        const l2 = letters.charAt(Math.floor(Math.random() * 26));
        return `NP ${l1}${l2} ${Math.floor(Math.random() * 2000) + 1000}`;
    } else if (brand === 'Berger') {
        // Format: 5D0234
        const num = Math.floor(Math.random() * 9);
        const lettr = 'ABCDT'.charAt(Math.floor(Math.random() * 5));
        const end = String(Math.floor(Math.random() * 9000) + 1000);
        return `${num}${lettr}${end}`;
    } else if (brand === 'Sherwin Williams') {
        // Format: SW 6245
        return `SW ${Math.floor(Math.random() * 5000) + 6000}`; // 6000-9000 range usually
    }
    return `ID-${index}`;
};

const generateDatabase = () => {
    const db = { interior: {}, exterior: {} };
    const usedCodes = new Set(); // Prevent duplicates

    ['interior', 'exterior'].forEach(type => {
        tones.forEach(tone => {
            db[type][tone] = [];
            const config = baseHues[tone];

            const colorsPerBrand = 150; // High volume

            brands.forEach((brand, bIndex) => {
                for (let i = 0; i < colorsPerBrand; i++) {

                    let h;
                    if (tone === 'red') {
                        const span = (360 - config.hMin) + config.hMax;
                        let val = Math.random() * span + config.hMin;
                        if (val > 360) val -= 360;
                        h = val;
                    } else {
                        h = Math.random() * (config.hMax - config.hMin) + config.hMin;
                    }

                    const s = Math.floor(Math.random() * (config.sRange[1] - config.sRange[0]) + config.sRange[0]);
                    const l = Math.floor(Math.random() * (config.lRange[1] - config.lRange[0]) + config.lRange[0]);

                    const hex = hslToHex(h, s, l);

                    // Unique Code Generation
                    let code;
                    let attempts = 0;
                    do {
                        code = generateCode(brand, i, h, s, l);
                        attempts++;
                    } while (usedCodes.has(code) && attempts < 10);
                    usedCodes.add(code);

                    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
                    const noun = nouns[tone][Math.floor(Math.random() * nouns[tone].length)];
                    const name = `${adj} ${noun}`;

                    db[type][tone].push({
                        code,
                        hex,
                        name,
                        brand,
                        type,
                        _h: h,
                        _l: l
                    });
                }
            });

            // Sort by Hue for gradient look
            db[type][tone].sort((a, b) => {
                if (Math.abs(a._h - b._h) > 5) return a._h - b._h;
                return b._l - a._l;
            });
        });
    });

    return db;
};

export const paintDatabase = generateDatabase();
