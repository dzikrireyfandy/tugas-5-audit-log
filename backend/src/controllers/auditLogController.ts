import type { Request, Response } from 'express';
import { parseAuditLogQuery } from '../schemas/auditLogSchema.ts';
import { AuditLogService } from '../services/auditLogService.ts';
import { ValidationError } from '../errors/ValidationError.ts';

export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService = new AuditLogService(),
  ) {}

  getAll = async (req: Request, res: Response): Promise<void> => {
    const query = parseAuditLogQuery(req.query);
    const data = await this.auditLogService.list(query);

    res.status(200).json({
      status: 'success',
      data,
    });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError([{ field: 'id', message: 'ID harus bilangan bulat positif' }]);
    }

    const data = await this.auditLogService.getById(id);
    res.status(200).json({
      status: 'success',
      data,
    });
  };
}
