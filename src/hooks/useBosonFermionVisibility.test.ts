import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useBosonFermionVisibility,
  getDefaultBosonFermionVisibility,
  BOSON_FERMION_DEFAULT_MIN_WIDTH,
} from './useBosonFermionVisibility';

const originalWidth = window.innerWidth;

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
}

describe('useBosonFermionVisibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    setWidth(originalWidth);
    localStorage.clear();
  });

  it('defaults to shown on wide screens', () => {
    setWidth(BOSON_FERMION_DEFAULT_MIN_WIDTH);
    expect(getDefaultBosonFermionVisibility()).toBe(true);
    const { result } = renderHook(() => useBosonFermionVisibility('bf-test'));
    expect(result.current[0]).toBe(true);
  });

  it('defaults to hidden on narrow screens', () => {
    setWidth(BOSON_FERMION_DEFAULT_MIN_WIDTH - 1);
    const { result } = renderHook(() => useBosonFermionVisibility('bf-test'));
    expect(result.current[0]).toBe(false);
  });

  it('does not persist the default until explicitly set', () => {
    setWidth(1440);
    renderHook(() => useBosonFermionVisibility('bf-test'));
    expect(localStorage.getItem('bf-test')).toBeNull();
  });

  it('prefers and persists an explicit user preference', () => {
    setWidth(1440);
    localStorage.setItem('bf-test', 'false');
    const { result } = renderHook(() => useBosonFermionVisibility('bf-test'));
    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('bf-test')).toBe('true');
  });

  it('ignores invalid stored values', () => {
    setWidth(400);
    localStorage.setItem('bf-test', '{not json');
    const { result } = renderHook(() => useBosonFermionVisibility('bf-test'));
    expect(result.current[0]).toBe(false);
  });
});
