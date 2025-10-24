// Vitest test setup file
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test case (for React components)
afterEach(() => {
  cleanup();
});
