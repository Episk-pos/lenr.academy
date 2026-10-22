import { describe, it, expect } from 'vitest';
import { computeDropdownPosition } from './dropdownPosition';

const rect = (left: number, width: number, top = 10, height = 40) => ({
  left,
  right: left + width,
  width,
  top,
  bottom: top + height,
});

describe('computeDropdownPosition', () => {
  describe('below (mobile header)', () => {
    it('LTR: aligns the menu to the trigger right edge', () => {
      // 375px viewport, compact trigger near the right edge
      const pos = computeDropdownPosition(rect(280, 40), 'below', false, 375);
      expect(pos).toEqual({ top: 58, left: 120, width: 200 });
    });

    it('RTL: mirrors to the trigger left edge', () => {
      // Mirrored header: trigger near the left edge; LTR math would give -88
      const pos = computeDropdownPosition(rect(55, 40), 'below', true, 375);
      expect(pos.left).toBe(55);
      expect(pos.width).toBe(200);
    });

    it('LTR: clamps to the left margin when the trigger is near the left edge', () => {
      expect(computeDropdownPosition(rect(20, 40), 'below', false, 375).left).toBe(8);
    });

    it('RTL: clamps to the right margin when the trigger is near the right edge', () => {
      expect(computeDropdownPosition(rect(300, 40), 'below', true, 375).left).toBe(375 - 200 - 8);
    });
  });

  describe('above (desktop sidebar)', () => {
    it('LTR: aligns the menu to the trigger left edge', () => {
      const pos = computeDropdownPosition(rect(16, 224, 700), 'above', false, 1440);
      expect(pos).toEqual({ top: 692, left: 16, width: 224 });
    });

    it('RTL: mirrors to the trigger right edge', () => {
      const pos = computeDropdownPosition(rect(1200, 224, 700), 'above', true, 1440);
      expect(pos.left).toBe(1200);
      // Narrow trigger: menu right edge aligns with trigger right edge
      expect(computeDropdownPosition(rect(1100, 40, 700), 'above', true, 1440).left).toBe(940);
    });

    it('LTR: clamps when the collapsed sidebar sits on the right edge', () => {
      // Collapsed RTL-style sidebar trigger at the far right but LTR math (left = rect.left)
      expect(computeDropdownPosition(rect(1388, 40, 700), 'above', false, 1440).left).toBe(1440 - 200 - 8);
    });

    it('RTL: clamps to the left margin when the trigger is near the left edge', () => {
      expect(computeDropdownPosition(rect(4, 40, 700), 'above', true, 1440).left).toBe(8);
    });
  });

  it('pins to the left margin when the viewport is narrower than the menu', () => {
    expect(computeDropdownPosition(rect(10, 40), 'below', true, 150).left).toBe(8);
  });
});
