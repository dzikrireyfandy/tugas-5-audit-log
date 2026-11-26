const actionLabels: Record<string, string> = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  CREATE_STALL: 'Tambah warung',
  UPDATE_STALL: 'Ubah warung',
  DELETE_STALL: 'Hapus warung',
  CREATE_REVIEW: 'Tambah review',
  CREATE_MENU: 'Tambah menu',
  UPDATE_MENU: 'Ubah menu',
  DELETE_MENU: 'Hapus menu',
}

const targetLabels: Record<string, string> = {
  USERS: 'Pengguna',
  STALLS: 'Warung',
  REVIEWS: 'Review',
  MENU_ITEMS: 'Menu',
}

export const auditActionOptions = Object.entries(actionLabels).map(
  ([value, label]) => ({ value, label }),
)

export const auditTargetOptions = Object.entries(targetLabels).map(
  ([value, label]) => ({ value, label }),
)

export function actionLabel(action: string): string {
  return actionLabels[action] ?? action
}

export function targetLabel(targetTable: string): string {
  return targetLabels[targetTable] ?? targetTable
}

export function actionBadgeClass(action: string): string {
  if (action === 'LOGIN' || action === 'LOGOUT') {
    return 'bg-sage text-pine border border-pine/20'
  }
  if (action.startsWith('CREATE_')) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  }
  if (action.startsWith('UPDATE_')) {
    return 'bg-amber-50 text-amber-700 border border-amber-200'
  }
  if (action.startsWith('DELETE_')) {
    return 'bg-chili-soft text-chili border border-chili/30'
  }
  return 'bg-gray-100 text-gray-700 border border-gray-200'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function describeMetadata(metadata: unknown): string {
  if (!isRecord(metadata)) return 'Tidak ada detail'

  if (typeof metadata.orderCode === 'string') return metadata.orderCode

  for (const key of ['after', 'before']) {
    const value = metadata[key]

    if (isRecord(value) && typeof value.name === 'string') {
      return value.name
    }
  }

  if (typeof metadata.role === 'string') {
    const ip = typeof metadata.ip_address === 'string' ? ` (${metadata.ip_address})` : ''
    return `Role: ${metadata.role}${ip}`
  }

  if (typeof metadata.rating === 'number') {
    return `Rating: ${metadata.rating}★`
  }

  if (Array.isArray(metadata.changed)) {
    return metadata.changed.length > 0
      ? `Field: ${metadata.changed.join(', ')}`
      : 'Tidak ada field berubah'
  }

  return 'Lihat detail'
}

export function formatMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) {
    return 'Tidak ada metadata.'
  }

  if (typeof metadata === 'string') return metadata

  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return String(metadata)
  }
}

export function extractIpAndAgent(metadata: unknown): { ip_address?: string; user_agent?: string } {
  if (isRecord(metadata)) {
    return {
      ip_address: typeof metadata.ip_address === 'string' ? metadata.ip_address : undefined,
      user_agent: typeof metadata.user_agent === 'string' ? metadata.user_agent : undefined,
    }
  }
  return {}
}
