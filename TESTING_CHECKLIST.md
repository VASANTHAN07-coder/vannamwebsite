# 🧪 Quick Testing Checklist

## Color-Based Flood Fill Algorithm - Validation Guide

### What to Test

#### ✅ Test 1: Wall Uniformity
- [ ] Upload building image
- [ ] Select a paint color
- [ ] Click on wall
- **Expected:** Entire wall fills with uniform color
- **Check:** No scattered pixels, no lines

#### ✅ Test 2: Boundary Respect
- [ ] Paint wall area
- **Expected:** Paint stops at window/door edges
- **Check:** Windows remain dark, not painted

#### ✅ Test 3: Sky Protection
- [ ] Try to click on sky area
- **Expected:** Nothing happens OR limited area paints (not sky)
- **Check:** Sky remains original color

#### ✅ Test 4: Color Consistency
- [ ] Paint one wall
- [ ] Select different color
- [ ] Paint same wall again
- **Expected:** New color fills uniformly
- **Check:** No color bleeding or artifacts

#### ✅ Test 5: Multiple Walls
- [ ] Paint left wall
- [ ] Paint right wall
- [ ] Paint front wall
- **Expected:** Each wall fills independently
- **Check:** No cross-contamination

#### ✅ Test 6: Texture Handling
- [ ] Paint textured wall with shadows
- **Expected:** Entire textured area fills
- **Check:** Shadows painted same color, no leakage

---

## Console Messages

### Good Signs ✅
```
✓ Painted 45000 pixels with COLOR-BASED flood fill - NO LEAKAGE
✓ Auto-painted 50000 pixels - COLOR-BASED, NO LEAKAGE, strict boundaries
```

### Bad Signs ❌
```
Painted very few pixels (< 100) on large wall
Paint didn't fill entire wall
Horizontal lines appearing
```

---

## Triple Boundary Validation

Every pixel painted must pass:

1. **Wall Map Check**
   - Is pixel in detected wall area?
   - ✅ Yes → Continue
   - ❌ No → Skip

2. **Edge Check**
   - Is pixel on sharp edge?
   - ✅ No → Continue
   - ❌ Yes → Skip

3. **Color Check**
   - Is pixel similar color to seed?
   - ✅ Yes (within tolerance) → Paint
   - ❌ No → Skip

---

## Brightness Range Logic

```
Pixel Brightness → Action

0 -------- 20: Pure Black (Windows) → ❌ SKIP
20 ------- 245: Wall Surface → ✅ CHECK COLOR
245 ------ 255: Pure White (Sky) → ❌ SKIP
```

---

## Real-World Test Cases

### Building Type 1: Bright White Building
- **Color Range:** 180-240 brightness
- **Expected:** Entire wall fills uniformly
- **Watch For:** Sky leakage (sky might be 240-255, should not paint)

### Building Type 2: Dark Gray Building
- **Color Range:** 80-160 brightness
- **Expected:** Entire wall fills uniformly
- **Watch For:** Shadow areas (might be below 20, correctly excluded)

### Building Type 3: Mixed Materials
- **Colors:** Brick (130), Concrete (200), Plaster (190)
- **Expected:** Only similar material paints with single click
- **Watch For:** Color tolerance (85) should handle texture variation

### Building Type 4: With Windows
- **Window Color:** 20-40 brightness
- **Wall Color:** 150-200 brightness
- **Expected:** Windows NOT painted, only wall
- **Watch For:** Sharp boundary between wall and window

---

## Performance Metrics

| Metric | Expected | OK | Problem |
|--------|----------|----|---------| 
| Paint Time | < 1 sec | < 3 sec | > 3 sec |
| Pixels Painted | 20,000-100,000 | ✅ Normal | Too few = boundary issue |
| Memory Usage | < 50MB | ✅ Normal | > 100MB = memory leak |
| Console Logs | "NO LEAKAGE" | ✅ Correct | No message = error |

---

## Debugging Steps

### Problem: Paint didn't fill wall

**Check:**
1. Did wall detection run? (Look for "Wall detection completed" in console)
2. Is brightness range correct? (Check pixel brightness)
3. Is color tolerance enough? (Try clicking different wall area)

**Solution:**
1. Run image analysis again
2. Upload different image
3. Try brighter/darker wall areas

### Problem: Paint leaked to non-wall area

**Check:**
1. Is wall boundary being detected? (Check "Wall Boundaries Detected" message)
2. Did color check fail? (Manual color diff calculation)

**Solution:**
1. This should NOT happen with new algorithm
2. If it does, verify algorithm loaded correctly
3. Check browser console for JS errors

### Problem: Horizontal lines appearing

**Check:**
1. Old algorithm still running?
2. Cache not cleared?
3. HMR not updating?

**Solution:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Close and reopen browser tab

---

## Final Verification

- [ ] No horizontal line artifacts
- [ ] No color leakage to non-walls
- [ ] Windows remain unpainted
- [ ] Entire wall fills with one click
- [ ] Multiple walls can be painted different colors
- [ ] Console shows "NO LEAKAGE" message
- [ ] All 6 tests above pass
- [ ] Results match Image 2 quality

---

## Success Criteria ✅

✅ **Algorithm is working correctly when:**
1. Clean, uniform wall fills
2. Zero leakage to other areas
3. Professional appearance
4. Matches Image 2 quality
5. Console confirms "NO LEAKAGE"
6. All edge cases handled

---

## Report Template

```
Test Date: _______________
Building Image: _______________
Browser: _______________

Results:
- Wall Uniformity: ✅ / ❌
- Boundary Respect: ✅ / ❌
- Sky Protection: ✅ / ❌
- Color Consistency: ✅ / ❌
- Multiple Walls: ✅ / ❌
- Texture Handling: ✅ / ❌

Console Output:
_________________________________

Issues Found:
_________________________________

Overall Status: ✅ PASS / ❌ FAIL
```

