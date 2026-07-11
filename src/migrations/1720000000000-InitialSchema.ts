import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1720000000000 implements MigrationInterface {
  name = 'InitialSchema1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enable uuid-ossp extension ───────────────────────
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
    );

    // ── Enum types ───────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "user_role_enum" AS ENUM('OPERATOR', 'SUPERVISOR')`,
    );
    await queryRunner.query(
      `CREATE TYPE "request_status_enum" AS ENUM('PENDING', 'QUEUED', 'PROCESSING', 'READY_FOR_REVIEW', 'COMPLETED', 'REQUEUED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "request_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "changed_by_type_enum" AS ENUM('USER', 'SYSTEM', 'WORKER')`,
    );

    // ── users table ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name"         character varying NOT NULL,
        "email"        character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "role"         "user_role_enum" NOT NULL,
        "isActive"     boolean NOT NULL DEFAULT true,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    // ── service_requests table ───────────────────────────
    await queryRunner.query(`
      CREATE TABLE "service_requests" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title"          character varying NOT NULL,
        "description"    text NOT NULL,
        "status"         "request_status_enum" NOT NULL DEFAULT 'PENDING',
        "priority"       "request_priority_enum" NOT NULL,
        "progress"       integer NOT NULL DEFAULT 0,
        "requeueCount"   integer NOT NULL DEFAULT 0,
        "reviewComment"  text,
        "createdById"    uuid NOT NULL,
        "assignedToId"   uuid,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_requests" PRIMARY KEY ("id")
      )
    `);

    // ── status_histories table ───────────────────────────
    await queryRunner.query(`
      CREATE TABLE "status_histories" (
        "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requestId"     uuid NOT NULL,
        "oldStatus"     "request_status_enum",
        "newStatus"     "request_status_enum" NOT NULL,
        "changedById"   uuid,
        "changedByType" "changed_by_type_enum" NOT NULL,
        "comment"       text,
        "changedAt"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_status_histories" PRIMARY KEY ("id")
      )
    `);

    // ── Indexes on service_requests ──────────────────────
    await queryRunner.query(`CREATE INDEX "IDX_service_request_status"       ON "service_requests" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_service_request_createdAt"    ON "service_requests" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_service_request_createdById"  ON "service_requests" ("createdById")`);
    await queryRunner.query(`CREATE INDEX "IDX_service_request_assignedToId" ON "service_requests" ("assignedToId")`);

    // ── Foreign keys ─────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "service_requests"
        ADD CONSTRAINT "FK_service_requests_createdBy"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "service_requests"
        ADD CONSTRAINT "FK_service_requests_assignedTo"
        FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "status_histories"
        ADD CONSTRAINT "FK_status_histories_request"
        FOREIGN KEY ("requestId") REFERENCES "service_requests"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "status_histories"
        ADD CONSTRAINT "FK_status_histories_changedBy"
        FOREIGN KEY ("changedById") REFERENCES "users"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Drop foreign keys ────────────────────────────────
    await queryRunner.query(`ALTER TABLE "status_histories"  DROP CONSTRAINT "FK_status_histories_changedBy"`);
    await queryRunner.query(`ALTER TABLE "status_histories"  DROP CONSTRAINT "FK_status_histories_request"`);
    await queryRunner.query(`ALTER TABLE "service_requests"  DROP CONSTRAINT "FK_service_requests_assignedTo"`);
    await queryRunner.query(`ALTER TABLE "service_requests"  DROP CONSTRAINT "FK_service_requests_createdBy"`);

    // ── Drop indexes ─────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_service_request_assignedToId"`);
    await queryRunner.query(`DROP INDEX "IDX_service_request_createdById"`);
    await queryRunner.query(`DROP INDEX "IDX_service_request_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_service_request_status"`);

    // ── Drop tables ──────────────────────────────────────
    await queryRunner.query(`DROP TABLE "status_histories"`);
    await queryRunner.query(`DROP TABLE "service_requests"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // ── Drop enum types ──────────────────────────────────
    await queryRunner.query(`DROP TYPE "changed_by_type_enum"`);
    await queryRunner.query(`DROP TYPE "request_priority_enum"`);
    await queryRunner.query(`DROP TYPE "request_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
