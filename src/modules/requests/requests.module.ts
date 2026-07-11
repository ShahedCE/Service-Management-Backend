import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceRequest } from '../../entities/service-request.entity';
import { StatusHistory } from '../../entities/status-history.entity';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { RequestsGateway } from './requests.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceRequest, StatusHistory]),
    AuthModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService, RequestsGateway],
  exports: [RequestsService, RequestsGateway],
})
export class RequestsModule {}
