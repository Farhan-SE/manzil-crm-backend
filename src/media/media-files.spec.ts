import { describe, expect, it } from 'vitest';
import { sniffMime } from './media-files.js';

const bytes = (...parts: (number[] | string)[]) =>
    Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'ascii') : Buffer.from(p))));

describe('sniffMime', () => {
    it('recognises photos and videos by their first bytes', () => {
        expect(sniffMime(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
        expect(sniffMime(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
        expect(sniffMime(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('image/webp');
        expect(sniffMime(bytes([0, 0, 0, 0x20], 'ftypisom'))).toBe('video/mp4');
        expect(sniffMime(bytes([0, 0, 0, 0x14], 'ftypqt  '))).toBe('video/quicktime');
    });

    it('refuses anything else, whatever its name or declared type', () => {
        expect(sniffMime(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
        expect(sniffMime(bytes('<!doctype html><script>'))).toBeNull();
        expect(sniffMime(bytes('%PDF-1.7'))).toBeNull();
        expect(sniffMime(Buffer.alloc(0))).toBeNull();
    });
});
