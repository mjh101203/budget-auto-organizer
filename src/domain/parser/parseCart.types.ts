export interface ParsedItem {
  name: string
  spec?: string
  url?: string
  qty: number
  unitPrice: number
  amount: number
  sourceLine: number
}

export type WarningCode =
  | 'EMPTY_INPUT'
  | 'NO_ITEMS'
  | 'QTY_PRICE_MISMATCH'
  | 'TOTAL_MISMATCH'
  | 'UNPARSED_LINE'
  | 'MISSING_QTY'
  | 'MISSING_PRICE'

export interface ParseWarning {
  code: WarningCode
  line?: number
  message: string
}

export type CartFormat = 'tsv' | 'block' | 'line'

export interface ParseResult {
  items: ParsedItem[]
  shippingFee: number
  vatFee: number
  declaredSubtotal?: number
  declaredTotal?: number
  warnings: ParseWarning[]
  format: CartFormat
}
