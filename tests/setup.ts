// Test setup file
// Runs before all tests

import '@jest/globals';

// Mock chrome APIs for testing
(global as any).chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path: string) => `chrome-extension://fake-id/${path}`)
  },
  offscreen: {
    createDocument: jest.fn()
  },
  downloads: {
    download: jest.fn()
  },
  identity: {
    getAuthToken: jest.fn()
  }
} as any;

// Increase timeout for PDF processing tests
jest.setTimeout(10000);
