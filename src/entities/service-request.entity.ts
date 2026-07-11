import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { RequestStatus, RequestPriority } from './enums';
import { User } from './user.entity';
import { StatusHistory } from './status-history.entity';

@Entity('service_requests')
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Index('IDX_service_request_status')
  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column({ type: 'enum', enum: RequestPriority })
  priority: RequestPriority;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'int', default: 0 })
  requeueCount: number;

  @Column('text', { nullable: true })
  reviewComment: string | null;

  // ── Foreign keys ───────────────────────────────────────

  @Index('IDX_service_request_createdById')
  @Column('uuid')
  createdById: string;

  @Index('IDX_service_request_assignedToId')
  @Column('uuid', { nullable: true })
  assignedToId: string | null;

  @Index('IDX_service_request_createdAt')
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ── Relations ──────────────────────────────────────────

  @ManyToOne(() => User, (user) => user.createdRequests)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @ManyToOne(() => User, (user) => user.assignedRequests, { nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User | null;

  @OneToMany(() => StatusHistory, (sh) => sh.request)
  statusHistories: StatusHistory[];
}
