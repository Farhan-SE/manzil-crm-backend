import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Credentials come from the default AWS chain: env keys locally, the task or Lambda role on AWS.
export const s3 = new S3Client({});

export function importBucket() {
    const name = process.env.IMPORT_BUCKET;
    if (!name) throw new Error('IMPORT_BUCKET is not set');
    return name;
}

export async function uploadExists(key: string) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: importBucket(), Key: key }));
        return true;
    } catch (error) {
        if ((error as { name?: string }).name === 'NotFound') return false;
        throw error;
    }
}

export async function readUpload(key: string) {
    const object = await s3.send(new GetObjectCommand({ Bucket: importBucket(), Key: key }));
    return Buffer.from(await object.Body!.transformToByteArray());
}
