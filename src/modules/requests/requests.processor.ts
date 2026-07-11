import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSource, QueryRunner } from 'typeorm';
import { ServiceRequest } from '../../entities/service-request.entity';
import { StatusHistory } from '../../entities/status-history.entity';
import { RequestStatus, ChangedByType } from '../../entities/enums';
import { RequestsGateway } from './requests.gateway';

const TERMINAL_STATUSES = [
  RequestStatus.COMPLETED,
  RequestStatus.CANCELLED,
  RequestStatus.FAILED,
];

@Processor('processing', { concurrency: 5 })
export class RequestsProcessor extends WorkerHost {
  private readonly logger = new Logger(RequestsProcessor.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly gateway: RequestsGateway,
  ) {
    super();
  }

  async process(job: Job<{ requestId: string }>): Promise<void> {
    const { requestId } = job.data;
    this.logger.log(`Processing job ${job.id} for request ${requestId}`);

    // ── Step 1: PENDING → QUEUED ─────────────────────────
    const request = await this.transitionStatus(
      requestId,
      [RequestStatus.PENDING, RequestStatus.REQUEUED],
      RequestStatus.QUEUED,
      'Job picked up by worker',
    );

    if (!request) {
      this.logger.warn(
        `Request ${requestId} — skipped (terminal or unexpected state)`,
      );
      return;
    }

    this.gateway.emitRequestQueued(request);

    // ── Step 2: QUEUED → PROCESSING ──────────────────────
    const processing = await this.transitionStatus(
      requestId,
      [RequestStatus.QUEUED],
      RequestStatus.PROCESSING,
      'Worker started processing',
    );

    if (!processing) {
      this.logger.warn(
        `Request ${requestId} — skipped PROCESSING transition`,
      );
      return;
    }

    this.gateway.emitRequestProcessing(processing);

    // ── Step 3: Simulate work — progress 0→100 ──────────
    for (let progress = 20; progress <= 100; progress += 20) {
      await this.sleep(2000);

      // Re-check status before each tick (could have been cancelled)
      const current = await this.updateProgress(requestId, progress);
      if (!current) {
        this.logger.warn(
          `Request ${requestId} — aborted at ${progress}% (cancelled or failed)`,
        );
        return;
      }

      this.gateway.emitRequestProgressUpdated(current);
    }

    // ── Step 4: PROCESSING → READY_FOR_REVIEW ────────────
    const ready = await this.transitionStatus(
      requestId,
      [RequestStatus.PROCESSING],
      RequestStatus.READY_FOR_REVIEW,
      'Processing complete — awaiting supervisor review',
    );

    if (!ready) {
      this.logger.warn(
        `Request ${requestId} — skipped READY_FOR_REVIEW transition`,
      );
      return;
    }

    this.gateway.emitRequestReadyForReview(ready);
    this.logger.log(`Request ${requestId} — ready for review`);
  }

  // ── Transaction helpers ─────────────────────────────────

  /**
   * Atomically transition a request's status using pessimistic_write lock.
   * Returns the updated request on success, or null if the current status
   * doesn't match any expected status (idempotency guard).
   */
  private async transitionStatus(
    requestId: string,
    expectedStatuses: RequestStatus[],
    newStatus: RequestStatus,
    comment: string,
  ): Promise<ServiceRequest | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(ServiceRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        this.logger.error(`Request ${requestId} not found`);
        await queryRunner.rollbackTransaction();
        return null;
      }

      // Idempotency guard — skip if already terminal or unexpected state
      if (
        TERMINAL_STATUSES.includes(request.status) ||
        !expectedStatuses.includes(request.status)
      ) {
        this.logger.warn(
          `Request ${requestId} — expected [${expectedStatuses}] but found ${request.status}, skipping`,
        );
        await queryRunner.rollbackTransaction();
        return null;
      }

      const oldStatus = request.status;
      request.status = newStatus;

      await queryRunner.manager.save(ServiceRequest, request);
      await this.insertHistoryTx(queryRunner, {
        requestId: request.id,
        oldStatus,
        newStatus,
        changedById: null,
        changedByType: ChangedByType.WORKER,
        comment,
      });

      await queryRunner.commitTransaction();
      return request;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update progress within a transaction + pessimistic lock.
   * Returns null if the request is no longer in PROCESSING state.
   */
  private async updateProgress(
    requestId: string,
    progress: number,
  ): Promise<ServiceRequest | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(ServiceRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request || request.status !== RequestStatus.PROCESSING) {
        await queryRunner.rollbackTransaction();
        return null;
      }

      request.progress = progress;
      await queryRunner.manager.save(ServiceRequest, request);

      await queryRunner.commitTransaction();
      return request;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Insert a StatusHistory row inside an existing transaction.
   */
  private async insertHistoryTx(
    queryRunner: QueryRunner,
    data: {
      requestId: string;
      oldStatus: RequestStatus;
      newStatus: RequestStatus;
      changedById: string | null;
      changedByType: ChangedByType;
      comment: string;
    },
  ): Promise<void> {
    const history = queryRunner.manager.create(StatusHistory, data);
    await queryRunner.manager.save(StatusHistory, history);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
