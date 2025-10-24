// Vitest test setup file
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test case (for React components)
afterEach(() => {
  cleanup();
});
