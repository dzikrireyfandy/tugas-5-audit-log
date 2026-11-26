import { ReviewRepository } from '../repositories/reviewRepository.ts';
import { StallRepository } from '../repositories/stallRepository.ts';
import { AuditLogService } from './auditLogService.ts';
import { withTransaction } from '../db/transaction.ts';
import type { ReviewResponseDto } from '../dtos/reviewDto.ts';
import { AppError } from '../errors/AppError.ts';
import { NotFoundError } from '../errors/NotFoundError.ts';
import type { CreateReviewInput } from '../schemas/reviewSchema.ts';

type ReviewRow = NonNullable<Awaited<ReturnType<ReviewRepository['create']>>>;

export class ReviewService {
  private reviewRepository: ReviewRepository;
  private stallRepository: StallRepository;
  private auditLogService: AuditLogService;

  constructor(
    reviewRepository: ReviewRepository = new ReviewRepository(),
    stallRepository: StallRepository = new StallRepository(),
    auditLogService: AuditLogService = new AuditLogService(),
  ) {
    this.reviewRepository = reviewRepository;
    this.stallRepository = stallRepository;
    this.auditLogService = auditLogService;
  }

  private toDto(row: ReviewRow): ReviewResponseDto {
    return {
      id: row.id,
      stallId: row.stallId,
      userId: row.userId,
      rating: row.rating,
      comment: row.comment,
      likeCount: row.likeCount,
      createdAt: row.createdAt
        ? row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString()
        : null,
    };
  }

  async createReview(
    stallId: number,
    userId: number,
    input: CreateReviewInput,
  ): Promise<ReviewResponseDto> {
    const stall = await this.stallRepository.findById(stallId);
    if (!stall) throw new NotFoundError('Warung tidak ditemukan');

    const existing = await this.reviewRepository.findByStallAndUser(stallId, userId);
    if (existing) {
      throw new AppError(409, 'Kamu sudah pernah memberi review untuk warung ini');
    }

    return withTransaction(async (transaction) => {
      const row = await this.reviewRepository.create(
        {
          stallId,
          userId,
          rating: input.rating,
          comment: input.comment ?? null,
        },
        transaction,
      );
      if (!row) throw new AppError(500, 'Review gagal disimpan');

      await this.reviewRepository.refreshStallSummary(stallId, transaction);

      await this.auditLogService.record(
        {
          userId,
          action: 'CREATE_REVIEW',
          targetTable: 'REVIEWS',
          targetId: row.id,
          metadata: {
            stallId,
            rating: input.rating,
            comment: input.comment ?? null,
          },
        },
        transaction,
      );

      return this.toDto(row);
    });
  }
}
