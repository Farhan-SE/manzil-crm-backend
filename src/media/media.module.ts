import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerProject } from '../partner-projects/partner-project.entity.js';
import { Unit } from '../units/unit.entity.js';
import { MediaShare } from './media-share.entity.js';
import { MediaController, MediaLinksController, PublicMediaLinksController } from './media.controller.js';
import { MediaShareService } from './media-share.service.js';
import { Tenant } from '../tenants/tenant.entity.js';
import { InventoryMedia } from './media.entity.js';
import { MediaService } from './media.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([InventoryMedia, MediaShare, Unit, PartnerProject, Tenant]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [MediaService, MediaShareService],
    controllers: [MediaController, MediaLinksController, PublicMediaLinksController],
    exports: [MediaService, MediaShareService],
})
export class MediaModule { }
