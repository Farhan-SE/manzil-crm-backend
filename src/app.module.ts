import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { InterestsModule } from './interests/interests.module.js';
import { SourcesModule } from './sources/sources.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { FollowUpsModule } from './follow-ups/follow-ups.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { PartnerProjectsModule } from './partner-projects/partner-projects.module.js';
import { UnitsModule } from './units/units.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { CustomerModule } from './customer/customer.module.js';
import { StatsModule } from './stats/stats.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { SalesDisputesModule } from './sales-disputes/sales-disputes.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { HelpModule } from './help/help.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal:true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
    }),
    AuthModule,
    LeadsModule,
    InterestsModule,
    SourcesModule,
    CategoriesModule,
    FollowUpsModule,
    ListingsModule,
    PartnerProjectsModule,
    UnitsModule,
    TeamsModule,
    CustomerModule,
    StatsModule,
    LocationsModule,
    NotificationsModule,
    SalesDisputesModule,
    ApprovalsModule,
    PaymentsModule,
    ReportsModule,
    HelpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
