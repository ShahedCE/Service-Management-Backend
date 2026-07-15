import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../../entities/enums';
import { ChatService } from './chat.service';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('active')
  @Roles(UserRole.SUPERVISOR)
  async getActiveChats() {
    return this.chatService.getActiveChats();
  }

  @Get(':operatorId')
  async getChatHistory(
    @Param('operatorId') operatorId: string,
    @CurrentUser() user: any,
  ) {
    // If the user is an OPERATOR, they can only fetch their own chat history.
    if (user.role === UserRole.OPERATOR && user.id !== operatorId) {
      throw new Error('Unauthorized access to chat history');
    }
    return this.chatService.getChatHistory(operatorId);
  }
}
