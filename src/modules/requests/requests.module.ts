import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceRequest } from '../../entities/service-request.entity';
import { StatusHistory } from '../../entities/status-history.entity';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceRequest, StatusHistory]),
    AuthModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
