import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { User } from './entities/user.entity';
import { ServiceRequest } from './entities/service-request.entity';
import { StatusHistory } from './entities/status-history.entity';
import { ChatMessage } from './entities/chat-message.entity';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'service_management_db',
  synchronize: false,
  logging: true,
  entities: [User, ServiceRequest, StatusHistory, ChatMessage],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
