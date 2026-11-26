import { z } from 'zod';
import { ValidationError } from '../errors/ValidationError.ts';

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Gunakan format tanggal YYYY-MM-DD.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return false;

    const [year, month, day] = value.split('-').map(Number);

    return (
      date.getFullYear() === year &&
      date.getMonth() + 1 === month &&
      date.getDate() === day
    );
  }, 'Tanggal tidak valid.');

export const auditLogQuerySchema = z
  .object({
    page: z.coerce
      .number({ invalid_type_error: 'page harus berupa angka' })
      .int('page harus berupa bilangan bulat')
      .min(1, 'page minimal 1. Nilai 0 atau negatif ditolak.')
      .default(1),
    pageSize: z.coerce
      .number({ invalid_type_error: 'pageSize harus berupa angka' })
      .int('pageSize harus berupa bilangan bulat')
      .min(1, 'pageSize minimal 1.')
      .max(100, 'pageSize maksimal 100.')
      .default(20),
    action: z.string().trim().max(50, 'action maksimal 50 karakter.').optional(),
    targetTable: z.string().trim().max(50, 'targetTable maksimal 50 karakter.').optional(),
    targetId: z.coerce
      .number({ invalid_type_error: 'targetId harus berupa angka' })
      .int('targetId harus berupa bilangan bulat')
      .positive('targetId harus bilangan bulat positif')
      .optional(),
    userId: z.coerce
      .number({ invalid_type_error: 'userId harus berupa angka' })
      .int('userId harus berupa bilangan bulat')
      .positive('userId harus bilangan bulat positif')
      .optional(),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
  })
  .strict()
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    {
      message: 'Tanggal awal tidak boleh melewati tanggal akhir.',
      path: ['from'],
    },
  );

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

/** Dipakai controller karena `req.query` di Express 5 bersifat read-only. */
export function parseAuditLogQuery(raw: unknown): AuditLogQuery {
  const result = auditLogQuerySchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? String(issue.path[0]) : 'query',
      message: issue.message,
    }));

    throw new ValidationError(issues);
  }

  return result.data;
}
