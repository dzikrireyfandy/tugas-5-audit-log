import {
  StallRepository,
  type FindAllStallParams as FindAllParams,
} from '../repositories/stallRepository.ts';
import { MenuItemRepository } from '../repositories/menuItemRepository.ts';
import { AuditLogService } from './auditLogService.ts';
import { withTransaction } from '../db/transaction.ts';
import type { StallResponseDto } from '../dtos/stallDto.ts';
import type { MenuItemDto } from '../dtos/stallDto.ts';
import { ForbiddenError } from '../errors/ForbiddenError.ts';
import { NotFoundError } from '../errors/NotFoundError.ts';
import type { AuthUser } from './tokenService.ts';
import type { CreateStallInput, UpdateStallInput } from '../schemas/stallSchema.ts';

type StallRow = NonNullable<Awaited<ReturnType<StallRepository['findById']>>>;

export class StallService {
  private stallRepository: StallRepository;
  private menuItemRepository: MenuItemRepository;
  private auditLogService: AuditLogService;

  constructor(
    stallRepository: StallRepository = new StallRepository(),
    menuItemRepository: MenuItemRepository = new MenuItemRepository(),
    auditLogService: AuditLogService = new AuditLogService(),
  ) {
    this.stallRepository = stallRepository;
    this.menuItemRepository = menuItemRepository;
    this.auditLogService = auditLogService;
  }

  private toDto(row: StallRow): StallResponseDto {
    const avgRating = Number(row.avgRating);
    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      category: row.category,
      location: row.location,
      description: row.description,
      avgRating,
      reviewCount: row.reviewCount,
      isPopular: avgRating >= 4.7,
    };
  }

  async getAllStalls(params: FindAllParams) {
    const { rows, total } = await this.stallRepository.findAll(params);
    return { data: rows.map((row) => this.toDto(row)), total };
  }

  async getStallById(id: number): Promise<StallResponseDto> {
    const row = await this.stallRepository.findById(id);
    if (!row) throw new NotFoundError('Warung tidak ditemukan');
    return this.toDto(row);
  }

  async getStallMenus(id: number): Promise<MenuItemDto[]> {
    const row = await this.stallRepository.findById(id);
    if (!row) throw new NotFoundError('Warung tidak ditemukan');
    return this.menuItemRepository.findByStallId(id);
  }

  async createStall(input: CreateStallInput, ownerId: number): Promise<StallResponseDto> {
    return withTransaction(async (transaction) => {
      const row = await this.stallRepository.create({ ...input, ownerId }, transaction);
      if (!row) throw new NotFoundError('Warung gagal dibuat');

      await this.auditLogService.record(
        {
          userId: ownerId,
          action: 'CREATE_STALL',
          targetTable: 'STALLS',
          targetId: row.id,
          metadata: {
            after: {
              name: row.name,
              category: row.category,
              location: row.location,
              description: row.description,
            },
          },
        },
        transaction,
      );

      return this.toDto(row);
    });
  }

  async updateStall(
    id: number,
    input: UpdateStallInput,
    user: AuthUser,
  ): Promise<StallResponseDto> {
    const current = await this.stallRepository.findById(id);
    if (!current) throw new NotFoundError('Warung tidak ditemukan');

    if (user.role !== 'admin' && current.ownerId !== user.id) {
      throw new ForbiddenError('Kamu hanya bisa mengubah warung milikmu sendiri');
    }

    return withTransaction(async (transaction) => {
      const row = await this.stallRepository.update(id, input, transaction);
      if (!row) throw new NotFoundError('Warung tidak ditemukan');

      const changed: string[] = [];
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      for (const key of ['name', 'category', 'location', 'description'] as const) {
        if (input[key] !== undefined && input[key] !== current[key]) {
          changed.push(key);
          before[key] = current[key];
          after[key] = input[key];
        }
      }

      await this.auditLogService.record(
        {
          userId: user.id,
          action: 'UPDATE_STALL',
          targetTable: 'STALLS',
          targetId: id,
          metadata: { before, after, changed },
        },
        transaction,
      );

      return this.toDto(row);
    });
  }

  async deleteStall(id: number, userId?: number): Promise<StallResponseDto> {
    const current = await this.stallRepository.findById(id);
    if (!current) throw new NotFoundError('Warung tidak ditemukan');

    return withTransaction(async (transaction) => {
      const row = await this.stallRepository.remove(id, transaction);
      if (!row) throw new NotFoundError('Warung tidak ditemukan');

      if (userId) {
        await this.auditLogService.record(
          {
            userId,
            action: 'DELETE_STALL',
            targetTable: 'STALLS',
            targetId: id,
            metadata: {
              before: {
                name: current.name,
                category: current.category,
                location: current.location,
                description: current.description,
              },
            },
          },
          transaction,
        );
      }

      return this.toDto(row);
    });
  }
}
