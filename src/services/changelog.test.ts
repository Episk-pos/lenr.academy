import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchReleaseNotes, clearReleaseNotesCache } from './changelog';

describe('changelog service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearReleaseNotesCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetchResponse(data: unknown, ok = true, status = 200) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Not Found',
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  }

  describe('fetchReleaseNotes', () => {
    it('fetches and maps release data', async () => {
      mockFetchResponse({
        tag_name: 'v0.1.0',
        name: 'Release v0.1.0',
        body: '## Changes\n- Added stuff',
        published_at: '2026-01-15T00:00:00Z',
        html_url: 'https://github.com/Episk-pos/lenr.academy/releases/tag/v0.1.0',
      });

      const notes = await fetchReleaseNotes('v0.1.0');
      expect(notes.tagName).toBe('v0.1.0');
      expect(notes.name).toBe('Release v0.1.0');
      expect(notes.body).toContain('Changes');
      expect(notes.publishedAt).toBe('2026-01-15T00:00:00Z');
      expect(notes.htmlUrl).toContain('releases/tag/v0.1.0');
    });

    it('normalizes tags without v prefix', async () => {
      mockFetchResponse({
        tag_name: 'v0.2.0',
        name: 'Release v0.2.0',
        body: 'changelog',
        published_at: '2026-02-01T00:00:00Z',
        html_url: 'https://github.com/Episk-pos/lenr.academy/releases/tag/v0.2.0',
      });

      const notes = await fetchReleaseNotes('0.2.0');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('v0.2.0'),
        expect.any(Object)
      );
      expect(notes.tagName).toBe('v0.2.0');
    });

    it('caches results for repeated requests', async () => {
      mockFetchResponse({
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        body: 'cached content',
        published_at: null,
        html_url: 'https://github.com/Episk-pos/lenr.academy/releases/tag/v1.0.0',
      });

      const first = await fetchReleaseNotes('v1.0.0');
      const second = await fetchReleaseNotes('v1.0.0');

      expect(first).toEqual(second);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('handles missing fields with defaults', async () => {
      mockFetchResponse({
        tag_name: 'v0.3.0',
      });

      const notes = await fetchReleaseNotes('v0.3.0');
      expect(notes.tagName).toBe('v0.3.0');
      expect(notes.name).toBe('v0.3.0');
      expect(notes.body).toBe('');
      expect(notes.publishedAt).toBeNull();
      expect(notes.htmlUrl).toContain('github.com/Episk-pos/lenr.academy/releases');
    });

    it('falls back to listing releases on 404', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: () => Promise.resolve({}),
            text: () => Promise.resolve('Not Found'),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve([
              {
                tag_name: 'v0.4.0',
                name: 'Found in list',
                body: 'found it',
                published_at: '2026-03-01T00:00:00Z',
                html_url: 'https://github.com/Episk-pos/lenr.academy/releases/tag/v0.4.0',
              },
            ]),
          text: () => Promise.resolve(''),
        });
      });

      const notes = await fetchReleaseNotes('v0.4.0');
      expect(notes.name).toBe('Found in list');
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws ReleaseNotFoundError when tag not in release list', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: () => Promise.resolve('Not Found'),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ tag_name: 'v0.5.0' }]),
          text: () => Promise.resolve(''),
        });
      });

      await expect(fetchReleaseNotes('v999.0.0')).rejects.toThrow('Release not found');
    });

    it('throws on non-404 HTTP errors', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server Error'),
      });

      await expect(fetchReleaseNotes('v0.1.0')).rejects.toThrow();
    });

    it('throws on network errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
      await expect(fetchReleaseNotes('v0.1.0')).rejects.toThrow('Network failure');
    });
  });

  describe('clearReleaseNotesCache', () => {
    it('clears cache so subsequent requests re-fetch', async () => {
      mockFetchResponse({
        tag_name: 'v2.0.0',
        name: 'v2.0.0',
        body: 'first',
        published_at: null,
        html_url: '',
      });

      await fetchReleaseNotes('v2.0.0');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      clearReleaseNotesCache();

      mockFetchResponse({
        tag_name: 'v2.0.0',
        name: 'v2.0.0',
        body: 'second',
        published_at: null,
        html_url: '',
      });

      const notes = await fetchReleaseNotes('v2.0.0');
      expect(notes.body).toBe('second');
    });
  });
});
