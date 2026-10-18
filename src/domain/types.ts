export type BudgetType = 'rne' | 'club'
export type Category = string
export type Severity = 'error' | 'warning' | 'info'

export interface Team {
  id: string
  name: string
  shortName: string
  type: BudgetType
  advisor: string
  leader: string
  members: string[]
  allocations: Record<Category, number>
}

export interface Item {
  id: string
  name: string
  spec?: string
  qty: number
  unitPrice: number
  category: Category
  shop?: string
  sourceLine?: number
  url?: string
}

export interface PurchaseRequest {
  id: string
  teamId: string
  purpose: string
  items: Item[]
  shippingFee: number
  vatFee: number
  status: 'submitted' | 'approved' | 'rejected'
  acknowledgements: { ruleId: string; itemId?: string; reason: string }[]
  history: {
    at: string
    actor: string
    action: 'submit' | 'approve' | 'reject' | 'resubmit'
    note?: string
  }[]
  createdAt: string
  decidedAt?: string
  decidedBy?: string
}

export interface AppState {
  version: 1
  teams: Team[]
  requests: PurchaseRequest[]
  nextSeq: number
}

export interface Finding {
  ruleId: string
  severity: Severity
  message: string
  itemId?: string
  category?: Category
}
