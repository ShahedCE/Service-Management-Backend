import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { User } from '../../entities/user.entity';
import { ServiceRequest } from '../../entities/service-request.entity';
import { StatusHistory } from '../../entities/status-history.entity';
import { UserRole } from '../../entities/enums';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const SUPERVISOR_EMAIL = process.env.SUPERVISOR_EMAIL || 'admin@service.com';
const SUPERVISOR_PASSWORD = process.env.SUPERVISOR_PASSWORD;
const SUPERVISOR_NAME = process.env.SUPERVISOR_NAME || 'Admin Supervisor';

async function seedSupervisor() {
  if (!SUPERVISOR_PASSWORD) {
    console.error(
      '   SUPERVISOR_PASSWORD is not set in .env.local — aborting seed.',
    );
    process.exit(1);
  }

  // Build a temporary DataSource for the seed script
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'service_management_db',
    entities: [User, ServiceRequest, StatusHistory],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('   Connected to database.');

  const userRepo = dataSource.getRepository(User);

  // Check if a supervisor with this email already exists
  const existing = await userRepo.findOne({
    where: { email: SUPERVISOR_EMAIL },
  });

  if (existing) {
    console.log(
      `   Supervisor "${SUPERVISOR_EMAIL}" already exists — skipping.`,
    );
    await dataSource.destroy();
    process.exit(0);
  }

  // Hash password and insert
  const passwordHash = await bcrypt.hash(SUPERVISOR_PASSWORD, 10);

  const supervisor = userRepo.create({
    name: SUPERVISOR_NAME,
    email: SUPERVISOR_EMAIL,
    passwordHash,
    role: UserRole.SUPERVISOR,
    isActive: true,
  });

  await userRepo.save(supervisor);
  console.log(`   Supervisor created: ${SUPERVISOR_EMAIL}`);

  await dataSource.destroy();
  process.exit(0);
}

seedSupervisor().catch((err) => {
  console.error('   Seed failed:', err);
  process.exit(1);
});
