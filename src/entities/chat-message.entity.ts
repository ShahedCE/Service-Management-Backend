import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  operatorId: string;

  @ManyToOne(() => User, (user) => user.operatorChatMessages)
  @JoinColumn({ name: 'operatorId' })
  operator: User;

  @Column()
  senderId: string;

  @ManyToOne(() => User, (user) => user.sentMessages)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
