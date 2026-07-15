import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '../../entities/chat-message.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async saveMessage(senderId: string, operatorId: string, content: string): Promise<ChatMessage> {
    const operator = await this.userRepository.findOne({ where: { id: operatorId } });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    const message = this.chatMessageRepository.create({
      senderId,
      operatorId,
      content,
    });

    const savedMessage = await this.chatMessageRepository.save(message);

    // Fetch relations for broadcast
    const result = await this.chatMessageRepository.findOne({
      where: { id: savedMessage.id },
      relations: { sender: true },
    });
    
    if (!result) {
      throw new Error('Message could not be saved or fetched.');
    }
    
    return result;
  }

  async getChatHistory(operatorId: string): Promise<ChatMessage[]> {
    return this.chatMessageRepository.find({
      where: { operatorId },
      relations: { sender: true },
      order: { createdAt: 'ASC' },
    });
  }

  async getActiveChats(): Promise<any[]> {
    // Returns a list of operators who have messages, along with the latest message.
    // We can do this cleanly using query builder.
    const latestMessages = await this.chatMessageRepository
      .createQueryBuilder('chat')
      .innerJoinAndSelect('chat.operator', 'operator')
      .orderBy('chat.createdAt', 'DESC')
      .getMany();

    // Group by operator and get the first one (latest)
    const activeChatsMap = new Map();
    for (const msg of latestMessages) {
      if (!activeChatsMap.has(msg.operatorId)) {
        activeChatsMap.set(msg.operatorId, {
          operator: msg.operator,
          latestMessage: msg,
        });
      }
    }

    return Array.from(activeChatsMap.values());
  }
}
