import { and, count, eq, like, type SQL } from 'drizzle-orm';
import sql from 'mssql';
import { getDb } from '../db/index.ts';
import { createRequest } from '../db/request.ts';
import { stalls } from '../db/schema.ts';

export interface FindAllStallParams {
  search?: string;
  category?: string;
  location?: string;
  page: number;
  limit: number;
}

export interface StallInput {
  ownerId: number;
  name: string;
  category?: string | null;
  location?: string | null;
  description?: string | null;
}

export class StallRepository {
  async findAll(params: FindAllStallParams) {
    const db = await getDb();

    const conditions: SQL[] = [];
    if (params.search) conditions.push(like(stalls.name, `%${params.search}%`));
    if (params.category) conditions.push(eq(stalls.category, params.category));
    if (params.location) conditions.push(eq(stalls.location, params.location));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (params.page - 1) * params.limit;

    // MSSQL: pagination memakai ORDER BY + OFFSET ... FETCH NEXT
    const rows = await db
      .select()
      .from(stalls)
      .where(where)
      .orderBy(stalls.id)
      .offset(offset)
      .fetch(params.limit);

    const totals = await db.select({ total: count() }).from(stalls).where(where);

    return { rows, total: Number(totals[0]?.total ?? 0) };
  }

  async findById(id: number, transaction?: sql.Transaction) {
    if (transaction) {
      const request = await createRequest(transaction);
      request.input('id', sql.Int, id);
      const res = await request.query(`
        SELECT id, owner_id AS ownerId, name, category, location, description, avg_rating AS avgRating, review_count AS reviewCount, created_at AS createdAt
        FROM dbo.STALLS
        WHERE id = @id
      `);
      return res.recordset[0];
    }
    const db = await getDb();
    const rows = await db.select().from(stalls).where(eq(stalls.id, id));
    return rows[0];
  }

  async create(input: StallInput, transaction?: sql.Transaction) {
    if (transaction) {
      const request = await createRequest(transaction);
      const res = await request
        .input('ownerId', sql.Int, input.ownerId)
        .input('name', sql.NVarChar(100), input.name)
        .input('category', sql.NVarChar(50), input.category ?? null)
        .input('location', sql.NVarChar(100), input.location ?? null)
        .input('description', sql.NVarChar(sql.MAX), input.description ?? null)
        .query(`
          INSERT INTO dbo.STALLS (owner_id, name, category, location, description, avg_rating, review_count)
          OUTPUT INSERTED.id, INSERTED.owner_id AS ownerId, INSERTED.name, INSERTED.category, INSERTED.location, INSERTED.description, INSERTED.avg_rating AS avgRating, INSERTED.review_count AS reviewCount, INSERTED.created_at AS createdAt
          VALUES (@ownerId, @name, @category, @location, @description, 0, 0)
        `);
      return res.recordset[0];
    }

    const db = await getDb();
    const rows = await db
      .insert(stalls)
      .output()
      .values({
        ownerId: input.ownerId,
        name: input.name,
        category: input.category ?? null,
        location: input.location ?? null,
        description: input.description ?? null,
        avgRating: '0.00',
        reviewCount: 0,
      });
    return rows[0];
  }

  async update(id: number, input: Partial<StallInput>, transaction?: sql.Transaction) {
    if (transaction) {
      const request = await createRequest(transaction);
      request.input('id', sql.Int, id);
      const setClauses: string[] = [];
      if (input.ownerId !== undefined) {
        request.input('ownerId', sql.Int, input.ownerId);
        setClauses.push('owner_id = @ownerId');
      }
      if (input.name !== undefined) {
        request.input('name', sql.NVarChar(100), input.name);
        setClauses.push('name = @name');
      }
      if (input.category !== undefined) {
        request.input('category', sql.NVarChar(50), input.category);
        setClauses.push('category = @category');
      }
      if (input.location !== undefined) {
        request.input('location', sql.NVarChar(100), input.location);
        setClauses.push('location = @location');
      }
      if (input.description !== undefined) {
        request.input('description', sql.NVarChar(sql.MAX), input.description);
        setClauses.push('description = @description');
      }
      if (setClauses.length === 0) {
        return this.findById(id, transaction);
      }
      const res = await request.query(`
        UPDATE dbo.STALLS
        SET ${setClauses.join(', ')}
        OUTPUT INSERTED.id, INSERTED.owner_id AS ownerId, INSERTED.name, INSERTED.category, INSERTED.location, INSERTED.description, INSERTED.avg_rating AS avgRating, INSERTED.review_count AS reviewCount, INSERTED.created_at AS createdAt
        WHERE id = @id
      `);
      return res.recordset[0];
    }

    const db = await getDb();
    const rows = await db
      .update(stalls)
      .set({
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      })
      .where(eq(stalls.id, id))
      .output();
    return rows[0];
  }

  async remove(id: number, transaction?: sql.Transaction) {
    if (transaction) {
      const request = await createRequest(transaction);
      request.input('id', sql.Int, id);
      const res = await request.query(`
        DELETE FROM dbo.STALLS
        OUTPUT DELETED.id, DELETED.owner_id AS ownerId, DELETED.name, DELETED.category, DELETED.location, DELETED.description, DELETED.avg_rating AS avgRating, DELETED.review_count AS reviewCount, DELETED.created_at AS createdAt
        WHERE id = @id
      `);
      return res.recordset[0];
    }

    const db = await getDb();
    const rows = await db.delete(stalls).where(eq(stalls.id, id)).output();
    return rows[0];
  }
}
