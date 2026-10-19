import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

// Credentials come from the default AWS chain: env keys locally, the task or Lambda role on AWS.
const s3 = new S3Client({});
const sqs = new SQSClient({});

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function bucket() {
    const name = process.env.IMPORT_BUCKET;
    if (!name) throw new Error('IMPORT_BUCKET is not set');
    return name;
}

/** A form the browser posts the file to directly, so large uploads never pass through the API. */
export function presignUpload(key: string) {
    return createPresignedPost(s3, {
        Bucket: bucket(),
        Key: key,
        Conditions: [['content-length-range', 1, MAX_UPLOAD_BYTES]],
        Expires: 15 * 60,
    });
}

export async function uploadExists(key: string) {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
        return true;
    } catch (error) {
        if ((error as { name?: string }).name === 'NotFound') return false;
        throw error;
    }
}

export async function readUpload(key: string) {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return Buffer.from(await object.Body!.transformToByteArray());
}

/** Whether imports run on the Lambda behind a queue; otherwise the API process runs them itself. */
export const queueConfigured = () => Boolean(process.env.IMPORT_QUEUE_URL);

export async function enqueueImport(jobId: string) {
    await sqs.send(new SendMessageCommand({ QueueUrl: process.env.IMPORT_QUEUE_URL, MessageBody: JSON.stringify({ jobId }) }));
}
