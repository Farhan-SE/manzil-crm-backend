import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { importBucket, s3 } from './import-files.js';

const sqs = new SQSClient({});

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** A form the browser posts the file to directly, so large uploads never pass through the API. */
export function presignUpload(key: string) {
    return createPresignedPost(s3, {
        Bucket: importBucket(),
        Key: key,
        Conditions: [['content-length-range', 1, MAX_UPLOAD_BYTES]],
        Expires: 15 * 60,
    });
}

/** Whether imports run on the Lambda behind a queue; otherwise the API process runs them itself. */
export const queueConfigured = () => Boolean(process.env.IMPORT_QUEUE_URL);

export async function enqueueImport(jobId: string) {
    await sqs.send(new SendMessageCommand({ QueueUrl: process.env.IMPORT_QUEUE_URL, MessageBody: JSON.stringify({ jobId }) }));
}
