USE review_kantin;
GO

SET XACT_ABORT ON;
GO

-- 1. Pastikan tabel AUDIT_LOGS memiliki constraint default UTC jika belum
IF EXISTS (
    SELECT 1 FROM sys.default_constraints
    WHERE name = N'DF_AUDIT_LOGS_created_at'
      AND parent_object_id = OBJECT_ID(N'dbo.AUDIT_LOGS')
)
BEGIN
    ALTER TABLE dbo.AUDIT_LOGS DROP CONSTRAINT DF_AUDIT_LOGS_created_at;
END
GO

ALTER TABLE dbo.AUDIT_LOGS
    ADD CONSTRAINT DF_AUDIT_LOGS_created_at
    DEFAULT SYSUTCDATETIME() FOR created_at;
GO

-- 2. Index untuk performa query dan sorting riwayat audit
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AUDIT_LOGS_created_at'
      AND object_id = OBJECT_ID(N'dbo.AUDIT_LOGS')
)
BEGIN
    CREATE INDEX IX_AUDIT_LOGS_created_at
        ON dbo.AUDIT_LOGS (created_at DESC, id DESC);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AUDIT_LOGS_user_created'
      AND object_id = OBJECT_ID(N'dbo.AUDIT_LOGS')
)
BEGIN
    CREATE INDEX IX_AUDIT_LOGS_user_created
        ON dbo.AUDIT_LOGS (user_id, created_at DESC);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AUDIT_LOGS_action_target_created'
      AND object_id = OBJECT_ID(N'dbo.AUDIT_LOGS')
)
BEGIN
    CREATE INDEX IX_AUDIT_LOGS_action_target_created
        ON dbo.AUDIT_LOGS (action, target_table, created_at DESC);
END
GO

-- 3. Trigger proteksi append-only: menolak UPDATE dan DELETE pada AUDIT_LOGS
CREATE OR ALTER TRIGGER TR_AUDIT_LOGS_AppendOnly
ON dbo.AUDIT_LOGS
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    THROW 50010, 'AUDIT_LOGS bersifat append-only.', 1;
END;
GO

PRINT 'Trigger TR_AUDIT_LOGS_AppendOnly dan index berhasil disiapkan.';
GO
