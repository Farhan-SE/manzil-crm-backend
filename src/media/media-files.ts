import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { importBucket, s3 } from '../customer/import-files.js';
import type { MediaKind } from './media.entity.js';

export const MEDIA_TYPES: Record<string, { kind: MediaKind; ext: string; maxBytes: number }> = {
    'image/jpeg': { kind: 'image', ext: 'jpg', maxBytes: 10 * 1024 * 1024 },
    'image/png': { kind: 'image', ext: 'png', maxBytes: 10 * 1024 * 1024 },
    'image/webp': { kind: 'image', ext: 'webp', maxBytes: 10 * 1024 * 1024 },
    'video/mp4': { kind: 'video', ext: 'mp4', maxBytes: 100 * 1024 * 1024 },
    'video/quicktime': { kind: 'video', ext: 'mov', maxBytes: 100 * 1024 * 1024 },
};

/** The type the file's own first bytes say it is; SVG and anything unlisted is refused. */
export function sniffMime(b: Buffer): string | null {
    if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    if (b.length >= 12 && b.subarray(4, 8).toString('ascii') === 'ftyp') {
        return b.subarray(8, 10).toString('ascii') === 'qt' ? 'video/quicktime' : 'video/mp4';
    }
    return null;
}

export function presignMediaUpload(key: string, mime: string, maxBytes: number) {
    return createPresignedPost(s3, {
        Bucket: importBucket(),
        Key: key,
        Fields: { 'Content-Type': mime },
        Conditions: [['content-length-range', 1, maxBytes], ['eq', '$Content-Type', mime]],
        Expires: 15 * 60,
    });
}

/** Size and first bytes of an upload, or null when nothing was uploaded under the key. */
export async function inspectUpload(key: string): Promise<{ size: number; head: Buffer } | null> {
    try {
        const [meta, part] = await Promise.all([
            s3.send(new HeadObjectCommand({ Bucket: importBucket(), Key: key })),
            s3.send(new GetObjectCommand({ Bucket: importBucket(), Key: key, Range: 'bytes=0-63' })),
        ]);
        return { size: meta.ContentLength ?? 0, head: Buffer.from(await part.Body!.transformToByteArray()) };
    } catch (error) {
        const name = (error as { name?: string }).name;
        if (name === 'NotFound' || name === 'NoSuchKey') return null;
        throw error;
    }
}

/** A short-lived link to view the file; the bucket itself stays private. */
export function mediaViewUrl(key: string, seconds = 15 * 60) {
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: importBucket(), Key: key }), { expiresIn: seconds });
}

export async function deleteMediaFile(key: string) {
    await s3.send(new DeleteObjectCommand({ Bucket: importBucket(), Key: key }));
}
