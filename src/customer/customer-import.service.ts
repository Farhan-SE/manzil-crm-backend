import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CustomerImport } from './customer-import.entity.js';
import { enqueueImport, presignUpload, queueConfigured } from './import-aws.js';
import { readUpload, uploadExists } from './import-files.js';
import { processImport } from './process-import.js';
import { tenantId } from '../tenants/tenant-context.js';

const ACTIVE = In(['queued', 'processing']);
const EXTENSIONS = ['.csv', '.xlsx'];

/**
 * Background client imports: the browser uploads to S3, then a worker reads the file and adds the
 * clients while the page polls the job for progress.
 */
@Injectable()
export class CustomerImportService {
    constructor(
        @InjectRepository(CustomerImport)
        private importRepository: Repository<CustomerImport>,
    ) { }

    /** Opens a job and returns where the browser should upload its file. */
    async create(fileName: string, userId: number) {
        const extension = EXTENSIONS.find((ext) => fileName.toLowerCase().endsWith(ext));
        if (!extension) throw new BadRequestException('Upload a .csv or .xlsx file');

        const job = this.importRepository.create({ tenant_id: tenantId(), created_by_id: userId, file_name: fileName, file_key: '' });
        job.file_key = `imports/${job.tenant_id}/${crypto.randomUUID()}${extension}`;
        await this.importRepository.save(job);
        return { job: this.serialize(job), upload: await presignUpload(job.file_key) };
    }

    /** Hands an uploaded file to the worker. One import runs per company at a time. */
    async start(id: string) {
        const job = await this.importRepository.findOne({ where: { id, tenant_id: tenantId() } });
        if (!job) throw new NotFoundException('Import not found');
        if (job.status !== 'uploading') return this.serialize(job);
        if (await this.importRepository.exists({ where: { tenant_id: job.tenant_id, status: ACTIVE } })) {
            throw new ConflictException('Another import is still running. Wait for it to finish first.');
        }
        if (!(await uploadExists(job.file_key))) throw new BadRequestException('The file has not finished uploading');

        await this.importRepository.update(job.id, { status: 'queued' });
        if (queueConfigured()) {
            await enqueueImport(job.id);
        } else {
            // Without a queue (local development) the API runs the import itself, after replying.
            setImmediate(() => void processImport(this.importRepository.manager, job.id, readUpload));
        }
        return this.serialize({ ...job, status: 'queued' });
    }

    async findOne(id: string) {
        const job = await this.importRepository.findOne({ where: { id, tenant_id: tenantId() } });
        if (!job) throw new NotFoundException('Import not found');
        return this.serialize(job);
    }

    /** The company's running import, if any, so a progress bar can pick it up after a reload. */
    async active() {
        const job = await this.importRepository.findOne({
            where: { tenant_id: tenantId(), status: ACTIVE },
            order: { created_at: 'DESC' },
        });
        // Wrapped because Nest sends a bare null as an empty body, which isn't JSON.
        return { job: job ? this.serialize(job) : null };
    }

    private serialize(job: CustomerImport) {
        const { file_key: _key, tenant_id: _tenant, ...rest } = job;
        return rest;
    }
}
