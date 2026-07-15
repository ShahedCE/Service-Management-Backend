import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from './enums';
import { ServiceRequest } from './service-request.entity';
import { StatusHistory } from './status-history.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ── Relations ──────────────────────────────────────────

  @OneToMany(() => ServiceRequest, (sr) => sr.createdBy)
  createdRequests: ServiceRequest[];

  @OneToMany(() => ServiceRequest, (sr) => sr.assignedTo)
  assignedRequests: ServiceRequest[];

  @OneToMany(() => StatusHistory, (sh) => sh.changedBy)
  statusChanges: StatusHistory[];

  @OneToMany(() => ChatMessage, (msg) => msg.operator)
  operatorChatMessages: ChatMessage[];

  @OneToMany(() => ChatMessage, (msg) => msg.sender)
  sentMessages: ChatMessage[];
}
