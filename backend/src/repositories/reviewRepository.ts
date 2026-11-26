import { and, avg, count, eq, sql } from 'drizzle-orm';
import mssql from 'mssql';
import { getDb } from '../db/index.ts';
import { createRequest } from '../db/request.ts';
import { reviews, stalls } from '../db/schema.ts';

export interface CreateReviewParams {
  stallId: number;
  userId: number;
  rating: number;
  comment: string | null;
}

export class ReviewRepository {
  async findByStallAndUser(stallId: number, userId: number, transaction?: mssql.Transaction) {
    if (transaction) {
      const request = await createRequest(transaction);
      request.input('stallId', mssql.Int, stallId);
      request.input('userId', mssql.Int, userId);
      const res = await request.query(`
        SELECT id, stall_id AS stallId, user_id AS userId, rating, comment, like_count AS likeCount, created_at AS createdAt
        FROM dbo.REVIEWS
        WHERE stall_id = @stallId AND user_id = @userId
      `);
      return res.recordset[0];
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.stallId, stallId), eq(reviews.userId, userId)));
    return rows[0];
  }

  async create(params: CreateReviewParams, transaction?: mssql.Transaction) {
    if (transaction) {
      const request = await createRequest(transaction);
      const res = await request
        .input('stallId', mssql.Int, params.stallId)
        .input('userId', mssql.Int, params.userId)
        .input('rating', mssql.Int, params.rating)
        .input('comment', mssql.NVarChar(mssql.MAX), params.comment)
        .query(`
          INSERT INTO dbo.REVIEWS (stall_id, user_id, rating, comment, like_count)
          OUTPUT INSERTED.id, INSERTED.stall_id AS stallId, INSERTED.user_id AS userId, INSERTED.rating, INSERTED.comment, INSERTED.like_count AS likeCount, INSERTED.created_at AS createdAt
          VALUES (@stallId, @userId, @rating, @comment, 0)
        `);
      return res.recordset[0];
    }

    const db = await getDb();
    const rows = await db
      .insert(reviews)
      .output()
      .values({
        stallId: params.stallId,
        userId: params.userId,
        rating: params.rating,
        comment: params.comment,
        likeCount: 0,
      });
    return rows[0];
  }

  async refreshStallSummary(stallId: number, transaction?: mssql.Transaction) {
    if (transaction) {
      const request = await createRequest(transaction);
      request.input('stallId', mssql.Int, stallId);
      const res = await request.query(`
        UPDATE s
        SET s.review_count = agg.cnt,
            s.avg_rating = agg.avg_rating
        OUTPUT INSERTED.id, INSERTED.owner_id AS ownerId, INSERTED.name, INSERTED.avg_rating AS avgRating, INSERTED.review_count AS reviewCount
        FROM dbo.STALLS s
        JOIN (
            SELECT stall_id, COUNT(*) AS cnt, CAST(AVG(CAST(rating AS DECIMAL(10,4))) AS DECIMAL(3,2)) AS avg_rating
            FROM dbo.REVIEWS
            WHERE stall_id = @stallId
            GROUP BY stall_id
        ) agg ON agg.stall_id = s.id;
      `);
      return res.recordset[0];
    }

    const db = await getDb();

    const stats = await db
      .select({
        total: count(),
        average: avg(sql<number>`cast(${reviews.rating} as decimal(10, 4))`),
      })
      .from(reviews)
      .where(eq(reviews.stallId, stallId));

    const total = Number(stats[0]?.total ?? 0);
    const average = Number(stats[0]?.average ?? 0);

    const updated = await db
      .update(stalls)
      .set({ reviewCount: total, avgRating: average.toFixed(2) })
      .where(eq(stalls.id, stallId))
      .output();

    return updated[0];
  }
}
