import 'dotenv/config';
process.env.NODE_ENV = 'test';
import http from 'node:http';
import { app } from './src/index.ts';
import { getPool } from './src/db/index.ts';

let server: http.Server;
let baseUrl = '';

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 3000;
      baseUrl = `http://localhost:${port}`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function request(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {},
) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, headers: res.headers, data: json };
}

async function main() {
  await startServer();
  const pool = await getPool();

  console.log('\n======================================================');
  console.log('🧪 PENGUJIAN TUGAS 5: AUDIT LOG SYSTEM & BONUS');
  console.log('======================================================\n');

  let adminToken = '';
  let ownerToken = '';
  let customerToken = '';
  let customerId = 0;

  // 1. PENGUJIAN LOGIN
  console.log('--- 1. Pengujian LOGIN & Audit LOGIN ---');
  // Login Admin
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'User-Agent': 'Mozilla/5.0 AdminTester/1.0' },
    body: { email: 'admin@kantin.test', password: 'admin123' },
  });
  console.log('Admin login status:', adminLogin.status);
  adminToken = adminLogin.data.data.token;

  // Login Owner
  const ownerLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'User-Agent': 'Mozilla/5.0 OwnerTester/1.0' },
    body: { email: 'budi.owner@kantin.test', password: 'rahasia123' },
  });
  console.log('Owner login status:', ownerLogin.status);
  ownerToken = ownerLogin.data.data.token;

  // Login Customer
  const customerLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'User-Agent': 'Mozilla/5.0 CustomerTester/1.0' },
    body: { email: 'andi@kantin.test', password: 'rahasia123' },
  });
  console.log('Customer login status:', customerLogin.status);
  customerToken = customerLogin.data.data.token;
  customerId = customerLogin.data.data.user.id;

  // Cek database untuk audit LOGIN
  const loginAudit = await pool.request().query(`
    SELECT TOP 3 a.id, a.action, a.target_table, a.target_id, a.metadata, u.email
    FROM dbo.AUDIT_LOGS a
    JOIN dbo.USERS u ON u.id = a.user_id
    WHERE a.action = 'LOGIN'
    ORDER BY a.id DESC
  `);
  console.log('Audit LOGIN di Database:', loginAudit.recordset);

  // 2. PENGUJIAN LOGOUT & AUDIT LOGOUT
  console.log('\n--- 2. Pengujian LOGOUT & Audit LOGOUT ---');
  const logoutRes = await request('/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'User-Agent': 'Mozilla/5.0 CustomerLogoutTester/1.0',
    },
  });
  console.log('Logout response status:', logoutRes.status, logoutRes.data);

  const logoutAudit = await pool.request().query(`
    SELECT TOP 1 a.id, a.action, a.target_table, a.target_id, a.metadata, u.email
    FROM dbo.AUDIT_LOGS a
    JOIN dbo.USERS u ON u.id = a.user_id
    WHERE a.action = 'LOGOUT'
    ORDER BY a.id DESC
  `);
  console.log('Audit LOGOUT di Database:', logoutAudit.recordset);

  // 3. PENGUJIAN RBAC (Role Based Access Control) PADA /api/audit-logs
  console.log('\n--- 3. Pengujian RBAC Endpoint Audit Log ---');
  const noTokenRes = await request('/api/audit-logs');
  console.log('Tanpa token (harus 401):', noTokenRes.status);

  const customerAccessRes = await request('/api/audit-logs', {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  console.log('Customer akses (harus 403):', customerAccessRes.status);

  const ownerAccessRes = await request('/api/audit-logs', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  console.log('Owner akses (harus 403):', ownerAccessRes.status);

  const adminAccessRes = await request('/api/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Admin akses (harus 200):', adminAccessRes.status);
  console.log('Pagination data:', adminAccessRes.data.data.pagination);
  console.log('Sample item:', adminAccessRes.data.data.items[0]);

  // 4. PENGUJIAN GET /api/audit-logs/:id
  console.log('\n--- 4. Pengujian GET /api/audit-logs/:id ---');
  const latestId = adminAccessRes.data.data.items[0]?.id;
  if (latestId) {
    const detailRes = await request(`/api/audit-logs/${latestId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`Detail log #${latestId} (harus 200):`, detailRes.status, detailRes.data);
  }

  const notFoundRes = await request('/api/audit-logs/999999', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Detail log tidak ada (harus 404):', notFoundRes.status, notFoundRes.data);

  // 5. PENGUJIAN FILTER QUERY
  console.log('\n--- 5. Pengujian Filter Query ---');
  const filterLoginRes = await request('/api/audit-logs?action=LOGIN&pageSize=5', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Filter action=LOGIN total:', filterLoginRes.data.data.pagination.total);

  const filterUserRes = await request(`/api/audit-logs?userId=${customerId}&pageSize=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Filter userId=${customerId} total:`, filterUserRes.data.data.pagination.total);

  const filterTargetIdRes = await request(`/api/audit-logs?targetId=${customerId}&targetTable=USERS`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Filter targetId=${customerId} total:`, filterTargetIdRes.data.data.pagination.total);

  // Skenario Error Filter
  const invalidDateRange = await request('/api/audit-logs?from=2026-11-20&to=2026-11-10', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('from > to (harus 400):', invalidDateRange.status, invalidDateRange.data);

  const unknownParam = await request('/api/audit-logs?hackerField=123', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Unknown query param (harus 400):', unknownParam.status, unknownParam.data);

  // 6. PENGUJIAN TRIGGER APPEND-ONLY
  console.log('\n--- 6. Pengujian Trigger TR_AUDIT_LOGS_AppendOnly ---');
  try {
    await pool.request().query("UPDATE dbo.AUDIT_LOGS SET action = 'HACKED' WHERE id = 1");
    console.error('ERROR: Update berhasil (Trigger gagal menolak)');
  } catch (err: any) {
    console.log('SUCCESS: Trigger menolak UPDATE! Pesan error:', err.message);
  }

  try {
    await pool.request().query('DELETE FROM dbo.AUDIT_LOGS WHERE id = 1');
    console.error('ERROR: Delete berhasil (Trigger gagal menolak)');
  } catch (err: any) {
    console.log('SUCCESS: Trigger menolak DELETE! Pesan error:', err.message);
  }

  // 7. PENGUJIAN BONUS: AUDIT STALLS & REVIEWS
  console.log('\n--- 7. Pengujian BONUS: Audit STALLS & REVIEWS ---');
  // Create Stall
  const createStallRes = await request('/stalls', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      name: 'Warung Test Audit ' + Date.now(),
      category: 'Makanan',
      location: 'Kantin Utara',
      description: 'Warung untuk menguji CREATE_STALL audit',
    },
  });
  console.log('Create stall status:', createStallRes.status);
  const newStallId = createStallRes.data.data.id;

  // Update Stall
  const updateStallRes = await request(`/stalls/${newStallId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: {
      name: 'Warung Test Audit (Updated)',
      category: 'Makanan',
      location: 'Kantin Selatan',
      description: 'Sudah diupdate lokasinya',
    },
  });
  console.log('Update stall status:', updateStallRes.status);

  // Create Review
  const createReviewRes = await request(`/stalls/${newStallId}/reviews`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      rating: 5,
      comment: 'Enak banget, mantap!',
    },
  });
  console.log('Create review status:', createReviewRes.status);

  // Delete Stall
  const deleteStallRes = await request(`/stalls/${newStallId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log('Delete stall status:', deleteStallRes.status);

  // Periksa audit log untuk STALLS dan REVIEWS
  const bonusAudits = await pool.request().query(`
    SELECT a.id, a.action, a.target_table, a.target_id, a.metadata
    FROM dbo.AUDIT_LOGS a
    WHERE a.target_id = ${newStallId} OR a.action IN ('CREATE_STALL', 'UPDATE_STALL', 'DELETE_STALL', 'CREATE_REVIEW')
    ORDER BY a.id DESC
  `);
  console.log('Audit Bonus Tercatat di Database (Top 4):', bonusAudits.recordset.slice(0, 4));

  console.log('\n======================================================');
  console.log('✅ SELURUH PENGUJIAN SELESAI!');
  console.log('======================================================\n');

  await stopServer();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Fatal Test Error:', err);
  if (server) await stopServer();
  process.exit(1);
});
