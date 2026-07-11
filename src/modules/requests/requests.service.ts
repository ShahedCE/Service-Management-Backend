import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ServiceRequest } from '../../entities/service-request.entity';
import { StatusHistory } from '../../entities/status-history.entity';
import { RequestStatus, ChangedByType, UserRole } from '../../entities/enums';
import {
  CreateRequestDto,
  UpdateRequestDto,
  RejectRequestDto,
  QueryRequestsDto,
} from './dto';

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(ServiceRequest)
    private readonly requestRepo: Repository<ServiceRequest>,
    @InjectRepository(StatusHistory)
    private readonly historyRepo: Repository<StatusHistory>,
  ) { }

  // ── Create ─────────────────────────────────────────────

  async create(dto: CreateRequestDto, user: AuthUser): Promise<ServiceRequest> {
    const request = this.requestRepo.create({
      ...dto,
      createdById: user.id,
      status: RequestStatus.PENDING,
    });

    const saved = await this.requestRepo.save(request);

    await this.insertHistory({
      requestId: saved.id,
      oldStatus: null,
      newStatus: RequestStatus.PENDING,
      changedById: user.id,
      changedByType: ChangedByType.USER,
      comment: null,
    });

    return saved;
  }

  // ── List with filters ──────────────────────────────────

  async findAll(query: QueryRequestsDto, user: AuthUser) {
    const {
      search,
      status,
      priority,
      createdBy,
      assignedTo,
      from,
      to,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
    } = query;

    const qb: SelectQueryBuilder<ServiceRequest> = this.requestRepo
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.createdBy', 'creator')
      .leftJoinAndSelect('sr.assignedTo', 'assignee');

    // OPERATOR sees only own (created or assigned)
    if (user.role === UserRole.OPERATOR) {
      qb.andWhere(
        '(sr.createdById = :userId OR sr.assignedToId = :userId)',
        { userId: user.id },
      );
    }

    if (search) {
      qb.andWhere('sr.title ILIKE :search', { search: `%${search}%` });
    }
    if (status) {
      qb.andWhere('sr.status = :status', { status });
    }
    if (priority) {
      qb.andWhere('sr.priority = :priority', { priority });
    }
    if (createdBy) {
      qb.andWhere('sr.createdById = :createdBy', { createdBy });
    }
    if (assignedTo) {
      qb.andWhere('sr.assignedToId = :assignedTo', { assignedTo });
    }
    if (from) {
      qb.andWhere('sr.createdAt >= :from', { from });
    }
    if (to) {
      qb.andWhere('sr.createdAt <= :to', { to });
    }

    // Validate sortBy to prevent injection
    const allowedSorts = [
      'createdAt',
      'updatedAt',
      'title',
      'status',
      'priority',
      'progress',
    ];
    const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'createdAt';

    qb.orderBy(`sr.${safeSort}`, order === 'ASC' ? 'ASC' : 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();

    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  // ── Find one ───────────────────────────────────────────

  async findOne(id: string, user: AuthUser): Promise<ServiceRequest> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: { createdBy: true, assignedTo: true },
    });

    if (!request) {
      throw new NotFoundException(`Service request ${id} not found`);
    }

    if (user.role === UserRole.OPERATOR) {
      if (
        request.createdById !== user.id &&
        request.assignedToId !== user.id
      ) {
        throw new ForbiddenException(
          'You can only view your own or assigned requests',
        );
      }
    }

    return request;
  }

  // ── Update (title/description only) ────────────────────

  async update(
    id: string,
    dto: UpdateRequestDto,
    user: AuthUser,
  ): Promise<ServiceRequest> {
    const request = await this.findOneOrFail(id);

    // Must be own request
    if (request.createdById !== user.id) {
      throw new ForbiddenException('You can only edit your own requests');
    }

    // Can only edit while PENDING
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        'Request can only be edited while in PENDING status',
      );
    }

    // Strip any status field that might have been passed
    const { title, description } = dto;
    if (title !== undefined) request.title = title;
    if (description !== undefined) request.description = description;

    return this.requestRepo.save(request);
  }

  // ── Approve ────────────────────────────────────────────

  async approve(id: string, user: AuthUser): Promise<ServiceRequest> {
    const request = await this.findOneOrFail(id);

    if (
      request.status !== RequestStatus.PENDING &&
      request.status !== RequestStatus.REQUEUED
    ) {
      throw new BadRequestException(
        `Cannot approve a request in ${request.status} status`,
      );
    }

    const oldStatus = request.status;
    request.status = RequestStatus.QUEUED;
    const saved = await this.requestRepo.save(request);

    await this.insertHistory({
      requestId: saved.id,
      oldStatus,
      newStatus: RequestStatus.QUEUED,
      changedById: user.id,
      changedByType: ChangedByType.USER,
      comment: 'Request approved',
    });

    return saved;
  }

  // ── Reject ─────────────────────────────────────────────

  async reject(
    id: string,
    dto: RejectRequestDto,
    user: AuthUser,
  ): Promise<ServiceRequest> {
    const request = await this.findOneOrFail(id);

    if (request.status !== RequestStatus.READY_FOR_REVIEW) {
      throw new BadRequestException(
        `Cannot reject a request in ${request.status} status`,
      );
    }

    const oldStatus = request.status;
    request.requeueCount += 1;
    request.reviewComment = dto.reviewComment;

    // If requeue count reaches 3, mark as FAILED
    if (request.requeueCount >= 3) {
      request.status = RequestStatus.FAILED;
    } else {
      request.status = RequestStatus.REQUEUED;
    }

    const saved = await this.requestRepo.save(request);

    await this.insertHistory({
      requestId: saved.id,
      oldStatus,
      newStatus: saved.status,
      changedById: user.id,
      changedByType: ChangedByType.USER,
      comment: dto.reviewComment,
    });

    return saved;
  }

  // ── Cancel ─────────────────────────────────────────────

  async cancel(id: string, user: AuthUser): Promise<ServiceRequest> {
    const request = await this.findOneOrFail(id);

    if (
      request.status === RequestStatus.COMPLETED ||
      request.status === RequestStatus.CANCELLED ||
      request.status === RequestStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot cancel a request in ${request.status} status`,
      );
    }

    const oldStatus = request.status;
    request.status = RequestStatus.CANCELLED;
    const saved = await this.requestRepo.save(request);

    await this.insertHistory({
      requestId: saved.id,
      oldStatus,
      newStatus: RequestStatus.CANCELLED,
      changedById: user.id,
      changedByType: ChangedByType.USER,
      comment: 'Request cancelled',
    });

    return saved;
  }

  // ── Status history ─────────────────────────────────────

  async getHistory(id: string, user: AuthUser): Promise<StatusHistory[]> {
    // Ensure user can access this request first
    await this.findOne(id, user);

    return this.historyRepo.find({
      where: { requestId: id },
      relations: { changedBy: true },
      order: { changedAt: 'ASC' },
    });
  }

  // ── Helpers ────────────────────────────────────────────

  private async findOneOrFail(id: string): Promise<ServiceRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Service request ${id} not found`);
    }
    return request;
  }

  private async insertHistory(data: {
    requestId: string;
    oldStatus: RequestStatus | null;
    newStatus: RequestStatus;
    changedById: string | null;
    changedByType: ChangedByType;
    comment: string | null;
  }): Promise<StatusHistory> {
    const history = this.historyRepo.create(data);
    return this.historyRepo.save(history);
  }
}
