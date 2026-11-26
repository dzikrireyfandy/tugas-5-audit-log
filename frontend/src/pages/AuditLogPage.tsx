import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  X,
} from 'lucide-react'
import { auditLogApi } from '../lib/api'
import {
  actionBadgeClass,
  actionLabel,
  auditActionOptions,
  auditTargetOptions,
  describeMetadata,
  extractIpAndAgent,
  formatMetadata,
  targetLabel,
} from '../lib/audit'
import { formatDate } from '../lib/format'
import { EmptyState, ErrorState, LoadingPanel } from '../components/ui'
import type { AuditLog, AuditLogFilters, AuditLogPagination } from '../types/auditLog'

const PAGE_SIZE = 20

interface FilterDraft {
  action: string
  targetTable: string
  targetId: string
  userId: string
  from: string
  to: string
}

const emptyFilters: FilterDraft = {
  action: '',
  targetTable: '',
  targetId: '',
  userId: '',
  from: '',
  to: '',
}

const emptyPagination: AuditLogPagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

export default function AuditLogPage() {
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(emptyFilters)
  const [filters, setFilters] = useState<FilterDraft>(emptyFilters)
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<AuditLogPagination>(emptyPagination)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // State untuk modal detail (memanggil GET /api/audit-logs/:id)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Panggil list audit logs
  useEffect(() => {
    let active = true

    const queryParams: AuditLogFilters = {
      page,
      pageSize: PAGE_SIZE,
      action: filters.action || undefined,
      targetTable: filters.targetTable || undefined,
      targetId: filters.targetId ? Number(filters.targetId) : undefined,
      userId: filters.userId ? Number(filters.userId) : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }

    auditLogApi
      .list(queryParams)
      .then((data) => {
        if (!active) return
        setLogs(data.items)
        setPagination(data.pagination)
        setError(null)
      })
      .catch((loadError: any) => {
        if (!active) return
        const msg =
          loadError.response?.data?.message ||
          loadError.response?.data?.errors?.[0]?.message ||
          loadError.message ||
          'Gagal memuat riwayat audit'
        setError(msg)
        setLogs([])
        setPagination(emptyPagination)
      })
      .finally(() => {
        if (!active) return
        setIsLoading(false)
        setIsRefreshing(false)
      })

    return () => {
      active = false
    }
  }, [filters, page, reloadToken])

  // Panggil GET /api/audit-logs/:id saat baris dipilih untuk modal detail
  useEffect(() => {
    if (selectedId === null) {
      setDetailLog(null)
      setDetailError(null)
      setIsDetailLoading(false)
      return
    }

    let active = true
    setIsDetailLoading(true)
    setDetailError(null)

    auditLogApi
      .get(selectedId)
      .then((data) => {
        if (!active) return
        setDetailLog(data)
      })
      .catch((loadError: any) => {
        if (!active) return
        const msg =
          loadError.response?.data?.message ||
          loadError.message ||
          'Gagal memuat detail catatan audit'
        setDetailError(msg)
      })
      .finally(() => {
        if (!active) return
        setIsDetailLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedId])

  const refresh = () => {
    setIsRefreshing(true)
    setReloadToken((t) => t + 1)
  }

  const retry = () => {
    setIsLoading(true)
    setReloadToken((t) => t + 1)
  }

  const applyFilters = () => {
    setIsLoading(true)
    setFilters({ ...draftFilters })
    setPage(1)
  }

  const resetFilters = () => {
    setIsLoading(true)
    setDraftFilters(emptyFilters)
    setFilters(emptyFilters)
    setPage(1)
    setReloadToken((t) => t + 1)
  }

  const goToPage = (nextPage: number) => {
    setIsLoading(true)
    setPage(nextPage)
    setReloadToken((t) => t + 1)
  }

  const { ip_address, user_agent } = detailLog
    ? extractIpAndAgent(detailLog.metadata)
    : {}

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header Halaman */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage px-2.5 py-0.5 text-xs font-bold text-pine">
              <ShieldCheck size={14} aria-hidden="true" />
              Admin
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Riwayat Audit Log
          </h1>
          <p className="mt-1 text-sm text-muted">
            Jejak aktivitas autentikasi, warung, review, dan sistem. Catatan bersifat append-only
            dan dilindungi trigger database.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={isRefreshing || isLoading}
          className="btn btn-outline"
        >
          <RefreshCw
            size={16}
            className={isRefreshing ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          <span>{isRefreshing ? 'Memperbarui...' : 'Segarkan'}</span>
        </button>
      </div>

      {/* Form Filter */}
      <div className="mb-6 rounded-2xl border border-line bg-white p-5 shadow-xs">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
        >
          <div>
            <label className="label">Aksi</label>
            <select
              className="input text-xs"
              value={draftFilters.action}
              onChange={(e) =>
                setDraftFilters((curr) => ({ ...curr, action: e.target.value }))
              }
            >
              <option value="">Semua aksi</option>
              {auditActionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Target</label>
            <select
              className="input text-xs"
              value={draftFilters.targetTable}
              onChange={(e) =>
                setDraftFilters((curr) => ({ ...curr, targetTable: e.target.value }))
              }
            >
              <option value="">Semua target</option>
              {auditTargetOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.value})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Target ID</label>
            <input
              type="number"
              min="1"
              placeholder="Contoh: 1"
              className="input text-xs"
              value={draftFilters.targetId}
              onChange={(e) =>
                setDraftFilters((curr) => ({ ...curr, targetId: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">User ID</label>
            <input
              type="number"
              min="1"
              placeholder="Contoh: 1"
              className="input text-xs"
              value={draftFilters.userId}
              onChange={(e) =>
                setDraftFilters((curr) => ({ ...curr, userId: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">Dari Tanggal</label>
            <input
              type="date"
              className="input text-xs"
              value={draftFilters.from}
              onChange={(e) =>
                setDraftFilters((curr) => ({ ...curr, from: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">Sampai Tanggal</label>
            <input
              type="date"
              className="input text-xs"
              value={draftFilters.to}
              onChange={(e) =>
                setDraftFilters((curr) => ({ ...curr, to: e.target.value }))
              }
            />
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
            <button type="submit" className="btn btn-primary text-xs">
              Terapkan Filter
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-outline text-xs"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Konten Utama */}
      {error ? (
        <ErrorState
          title="Riwayat audit gagal dimuat"
          message={error}
          onRetry={retry}
        />
      ) : isLoading ? (
        <LoadingPanel message="Memuat riwayat audit..." />
      ) : (
        <>
          {/* Kartu Ringkasan Statistik */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Total Catatan
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold text-pine">
                {pagination.total}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Di Halaman Ini
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold text-pine">
                {logs.length}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Halaman
              </p>
              <p className="mt-1 font-display text-2xl font-extrabold text-pine">
                {pagination.totalPages === 0 ? 0 : pagination.page} /{' '}
                {pagination.totalPages}
              </p>
            </div>
          </div>

          {logs.length === 0 ? (
            <EmptyState
              title="Belum ada catatan audit"
              description="Catatan audit akan muncul secara otomatis saat terjadi login, logout, atau perubahan data."
            />
          ) : (
            <>
              {/* Tabel Riwayat */}
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[840px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                        <th className="px-4 py-3.5">Waktu</th>
                        <th className="px-4 py-3.5">Aksi</th>
                        <th className="px-4 py-3.5">Target</th>
                        <th className="px-4 py-3.5">Pengguna</th>
                        <th className="px-4 py-3.5">Ringkasan</th>
                        <th className="px-4 py-3.5 text-right">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-paper/40 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${actionBadgeClass(
                                log.action,
                              )}`}
                            >
                              {actionLabel(log.action)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-ink">
                              {targetLabel(log.targetTable)}
                            </span>
                            {log.targetId !== null && (
                              <span className="ml-1 font-mono text-xs text-muted">
                                #{log.targetId}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="block font-semibold text-ink">
                              {log.userName ?? 'Sistem'}
                            </span>
                            {log.userEmail && (
                              <span className="block text-xs text-muted">
                                {log.userEmail}
                              </span>
                            )}
                          </td>
                          <td className="max-w-xs truncate px-4 py-3 text-xs text-muted">
                            {describeMetadata(log.metadata)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedId(log.id)}
                              className="btn btn-outline py-1 px-2.5 text-xs"
                            >
                              <Eye size={14} aria-hidden="true" />
                              Lihat
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted">
                  Menampilkan {logs.length} dari {pagination.total} catatan
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline py-1.5 px-3 text-xs"
                    disabled={page <= 1 || isLoading}
                    onClick={() => goToPage(Math.max(1, page - 1))}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                    Sebelumnya
                  </button>
                  <span className="text-xs font-semibold text-muted">
                    Halaman {pagination.totalPages === 0 ? 0 : pagination.page} dari{' '}
                    {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline py-1.5 px-3 text-xs"
                    disabled={page >= pagination.totalPages || isLoading}
                    onClick={() => goToPage(page + 1)}
                  >
                    Berikutnya
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal Detail (Memanggil GET /api/audit-logs/:id) */}
      {selectedId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <ScrollText className="size-5 text-pine" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold">Detail Catatan Audit #{selectedId}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-muted hover:bg-paper hover:text-ink"
                aria-label="Tutup modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4">
              {isDetailLoading ? (
                <div className="py-12 text-center text-muted">
                  <Loader2 className="mx-auto size-6 animate-spin text-pine" />
                  <p className="mt-2 text-xs">Memanggil GET /api/audit-logs/{selectedId}...</p>
                </div>
              ) : detailError ? (
                <div className="rounded-xl border border-chili/30 bg-chili-soft p-4 text-sm text-chili">
                  {detailError}
                </div>
              ) : detailLog ? (
                <div className="space-y-4">
                  {/* Badge & Target */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper p-3 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${actionBadgeClass(
                        detailLog.action,
                      )}`}
                    >
                      {actionLabel(detailLog.action)}
                    </span>
                    <span className="font-semibold text-ink">
                      {targetLabel(detailLog.targetTable)}
                      {detailLog.targetId !== null && ` #${detailLog.targetId}`}
                    </span>
                  </div>

                  {/* Informasi Utama */}
                  <dl className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-lg border border-line p-3">
                      <dt className="text-muted">Waktu Kejadian</dt>
                      <dd className="mt-0.5 font-semibold text-ink">
                        {formatDate(detailLog.createdAt)}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-line p-3">
                      <dt className="text-muted">Pelaku (Nama)</dt>
                      <dd className="mt-0.5 font-semibold text-ink">
                        {detailLog.userName ?? 'Sistem'}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-line p-3">
                      <dt className="text-muted">Email Pengguna</dt>
                      <dd className="mt-0.5 font-semibold text-ink">
                        {detailLog.userEmail ?? '-'}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-line p-3">
                      <dt className="text-muted">User ID</dt>
                      <dd className="mt-0.5 font-semibold text-ink">
                        {detailLog.userId ?? '-'}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-line p-3">
                      <dt className="text-muted">IP Address</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-pine">
                        {ip_address ?? '-'}
                      </dd>
                    </div>

                    <div className="rounded-lg border border-line p-3">
                      <dt className="text-muted">User Agent</dt>
                      <dd className="mt-0.5 max-h-16 overflow-y-auto font-mono text-[11px] text-muted">
                        {user_agent ?? '-'}
                      </dd>
                    </div>
                  </dl>

                  {/* Metadata JSON */}
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
                      Metadata Lengkap
                    </p>
                    <pre className="max-h-60 overflow-auto rounded-xl bg-ink p-3 font-mono text-xs text-sage">
                      {formatMetadata(detailLog.metadata)}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="btn btn-outline"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
