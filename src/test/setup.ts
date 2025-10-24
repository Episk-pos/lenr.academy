// Vitest test setup file
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test case (for React components)
afterEach(() => {
  cleanup();
});
