import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RequestStatus, ChangedByType } from './enums';
import { ServiceRequest } from './service-request.entity';
import { User } from './user.entity';

@Entity('status_histories')
export class StatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  requestId: string;

  @Column({ type: 'enum', enum: RequestStatus, nullable: true })
  oldStatus: RequestStatus | null;

  @Column({ type: 'enum', enum: RequestStatus })
  newStatus: RequestStatus;

  @Column('uuid', { nullable: true })
  changedById: string | null;

  @Column({ type: 'enum', enum: ChangedByType })
  changedByType: ChangedByType;

  @Column('text', { nullable: true })
  comment: string | null;

  @CreateDateColumn()
  changedAt: Date;

  // ── Relations ──────────────────────────────────────────

  @ManyToOne(() => ServiceRequest, (sr) => sr.statusHistories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requestId' })
  request: ServiceRequest;

  @ManyToOne(() => User, (user) => user.statusChanges, { nullable: true })
  @JoinColumn({ name: 'changedById' })
  changedBy: User | null;
}
