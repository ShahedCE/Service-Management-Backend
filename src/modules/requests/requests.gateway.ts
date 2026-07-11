import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../entities/enums';
import { ServiceRequest } from '../../entities/service-request.entity';

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
export class RequestsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RequestsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  // ── Connection Lifecycle ──────────────────────────────

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`Client ${client.id} — no token provided, disconnecting`);
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token as string);

      // Attach user data to the socket for later use
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.role = payload.role;

      // Join role-based rooms
      if (payload.role === UserRole.SUPERVISOR) {
        client.join('supervisor-room');
        this.logger.log(
          `SUPERVISOR ${payload.email} (${client.id}) joined supervisor-room`,
        );
      } else {
        const userRoom = `user-${payload.sub}`;
        client.join(userRoom);
        this.logger.log(
          `OPERATOR ${payload.email} (${client.id}) joined ${userRoom}`,
        );
      }
    } catch (error) {
      this.logger.warn(`Client ${client.id} — invalid JWT, disconnecting`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── Emit Helpers ──────────────────────────────────────
  // The service layer calls these methods AFTER a successful DB write.
  // Each method emits to supervisor-room AND the operator's personal room.

  private emitToRooms(
    eventName: string,
    payload: any,
    request: Pick<ServiceRequest, 'createdById' | 'assignedToId'>,
  ) {
    // Always emit to supervisors
    this.server.to('supervisor-room').emit(eventName, payload);

    // Emit to the creator's room
    if (request.createdById) {
      this.server.to(`user-${request.createdById}`).emit(eventName, payload);
    }

    // Emit to the assignee's room (if different from creator)
    if (request.assignedToId && request.assignedToId !== request.createdById) {
      this.server.to(`user-${request.assignedToId}`).emit(eventName, payload);
    }
  }

  // ── Per-event methods ─────────────────────────────────

  emitRequestCreated(request: ServiceRequest) {
    this.emitToRooms('requestCreated', request, request);
    this.logger.debug(`Emitted requestCreated: ${request.id}`);
  }

  emitRequestQueued(request: ServiceRequest) {
    this.emitToRooms('requestQueued', { requestId: request.id }, request);
    this.logger.debug(`Emitted requestQueued: ${request.id}`);
  }

  emitRequestProcessing(request: ServiceRequest) {
    this.emitToRooms('requestProcessing', { requestId: request.id }, request);
    this.logger.debug(`Emitted requestProcessing: ${request.id}`);
  }

  emitRequestProgressUpdated(request: ServiceRequest) {
    this.emitToRooms(
      'requestProgressUpdated',
      { requestId: request.id, progress: request.progress },
      request,
    );
    this.logger.debug(
      `Emitted requestProgressUpdated: ${request.id} → ${request.progress}%`,
    );
  }

  emitRequestReadyForReview(request: ServiceRequest) {
    this.emitToRooms('requestReadyForReview', request, request);
    this.logger.debug(`Emitted requestReadyForReview: ${request.id}`);
  }

  emitRequestCompleted(request: ServiceRequest) {
    this.emitToRooms('requestCompleted', request, request);
    this.logger.debug(`Emitted requestCompleted: ${request.id}`);
  }

  emitRequestRequeued(request: ServiceRequest) {
    this.emitToRooms('requestRequeued', request, request);
    this.logger.debug(`Emitted requestRequeued: ${request.id}`);
  }

  emitRequestFailed(request: ServiceRequest) {
    this.emitToRooms('requestFailed', request, request);
    this.logger.debug(`Emitted requestFailed: ${request.id}`);
  }

  emitRequestCancelled(request: ServiceRequest) {
    this.emitToRooms('requestCancelled', request, request);
    this.logger.debug(`Emitted requestCancelled: ${request.id}`);
  }

  // ── Generic helper for the service/worker layer ───────
  // Call this when you only need to emit a status-change by name.

  emitStatusChange(
    request: ServiceRequest,
    eventName: string,
  ) {
    this.emitToRooms(eventName, request, request);
    this.logger.debug(`Emitted ${eventName}: ${request.id}`);
  }
}
