import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { UserRole } from '../../entities/enums';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessageDto,
  ) {
    try {
      // 1. Authenticate if not already authenticated by RequestsGateway
      if (!client.data.userId) {
        const token =
          client.handshake.auth?.token || client.handshake.query?.token;
        if (!token) {
          throw new Error('No token provided');
        }
        const decoded = this.jwtService.verify(token as string);
        client.data.userId = decoded.sub;
        client.data.email = decoded.email;
        client.data.role = decoded.role;
      }

      const senderId = client.data.userId;
      const role = client.data.role;

      // 2. Determine target operatorId
      // If an operator is sending, force the operatorId to be their own ID.
      // If a supervisor is sending, trust the operatorId from the payload.
      const operatorId =
        role === UserRole.OPERATOR ? senderId : payload.operatorId;

      if (!operatorId) {
        throw new Error('operatorId is required');
      }

      // 3. Save the message to DB
      const savedMessage = await this.chatService.saveMessage(
        senderId,
        operatorId,
        payload.content,
      );

      // 4. Emit to supervisor-room and the specific operator's room
      // (These rooms are managed by RequestsGateway upon connection)
      const eventPayload = savedMessage;
      
      this.server.to('supervisor-room').emit('newMessage', eventPayload);
      this.server.to(`user-${operatorId}`).emit('newMessage', eventPayload);

      this.logger.debug(
        `Message from ${senderId} sent to operator room ${operatorId}`,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { operatorId?: string; isTyping: boolean },
  ) {
    try {
      // Authenticate if not already authenticated
      if (!client.data.userId) {
        const token =
          client.handshake.auth?.token || client.handshake.query?.token;
        if (!token) throw new Error('No token provided');
        const decoded = this.jwtService.verify(token as string);
        client.data.userId = decoded.sub;
        client.data.email = decoded.email;
        client.data.role = decoded.role;
      }

      const senderId = client.data.userId;
      const role = client.data.role;

      const operatorId =
        role === UserRole.OPERATOR ? senderId : payload.operatorId;

      if (!operatorId) return { success: false };

      const eventPayload = {
        operatorId,
        isTyping: payload.isTyping,
        senderId,
      };

      if (role === UserRole.OPERATOR) {
        // Broadcast to supervisor
        this.server.to('supervisor-room').emit('userTyping', eventPayload);
      } else {
        // Broadcast to operator
        this.server.to(`user-${operatorId}`).emit('userTyping', eventPayload);
      }
      return { success: true };
    } catch (error) {
      this.logger.error(`Error sending typing status: ${error.message}`);
      return { success: false };
    }
  }
}
