import { useState } from 'react'
import type { ClipboardEvent } from 'react'
import type { AppState, Item, PurchaseRequest, Team } from '../domain/types'
import { parseCart } from '../domain/parser/parseCart'
import { parseAmount } from '../domain/parser/normalize'
import type { ParseWarning } from '../domain/parser/parseCart.types'
import { classifyItem } from '../domain/classify'
import { checkRequest } from '../domain/rules'
import { remainingAfterDraft } from '../domain/budget'
import { suggestQuantityFix } from '../domain/suggest'
import { formatWon, itemAmount, sumWon } from '../domain/money'
import { BUDGET_CATEGORIES } from '../config/budget'
import { submit, resubmit } from '../domain/workflow'

interface Props {
  state: AppState
  team: Team
  actor: string
  existingRequest?: PurchaseRequest
  duplicateFrom?: PurchaseRequest
  onDone: (state: AppState, requestId: string) => void
  onCancel: () => void
}

let draftItemSeq = 0
function nextDraftItemId(): string {
  draftItemSeq += 1
  return `draft-item-${draftItemSeq}`
}

export function NewRequest({ state, team, actor, existingRequest, duplicateFrom, onDone, onCancel }: Props) {
  const [cartText, setCartText] = useState('')
  const [cartHtml, setCartHtml] = useState('')
  const [items, setItems] = useState<Item[]>(
    existingRequest?.items ?? duplicateFrom?.items.map((item) => ({ ...item, id: nextDraftItemId() })) ?? [],
  )
  const [shippingFee, setShippingFee] = useState(existingRequest?.shippingFee ?? duplicateFrom?.shippingFee ?? 0)
  const [vatFee, setVatFee] = useState(existingRequest?.vatFee ?? duplicateFrom?.vatFee ?? 0)
  const [purpose, setPurpose] = useState(existingRequest?.purpose ?? duplicateFrom?.purpose ?? '')
  const [acknowledgements, setAcknowledgements] = useState<PurchaseRequest['acknowledgements']>(
    existingRequest?.acknowledgements ?? [],
  )
  const [parseWarnings, setParseWarnings] = useState<ParseWarning[]>([])
  const [parsedLines, setParsedLines] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | undefined>(undefined)

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData('text/plain')
    const html = e.clipboardData.getData('text/html')
    if (text) setCartText(text)
    if (html) setCartHtml(html)
  }

  function handleParse() {
    const result = parseCart(cartText, cartHtml || undefined)
    const parsedItems: Item[] = result.items.map((pi) => ({
      id: nextDraftItemId(),
      name: pi.name,
      spec: pi.spec,
      qty: pi.qty,
      unitPrice: pi.unitPrice,
      category: classifyItem(pi.name, pi.spec, team.type),
      url: pi.url,
      sourceLine: pi.sourceLine,
    }))
    setItems(parsedItems)
    setShippingFee(result.shippingFee)
    setVatFee(result.vatFee)
    setParseWarnings(result.warnings)
    setParsedLines(cartText.split(/\r?\n/))
  }

  function addUnparsedLineAsItem(lineNo: number) {
    const rawLine = parsedLines[lineNo - 1] ?? ''
    const amount = parseAmount(rawLine) ?? 0
    setItems((prev) => [
      ...prev,
      {
        id: nextDraftItemId(),
        name: rawLine.trim(),
        qty: 1,
        unitPrice: amount,
        category: BUDGET_CATEGORIES[team.type][0],
      },
    ])
    setParseWarnings((prev) => prev.filter((w) => !(w.code === 'UNPARSED_LINE' && w.line === lineNo)))
  }

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: nextDraftItemId(), name: '', qty: 1, unitPrice: 0, category: BUDGET_CATEGORIES[team.type][0] },
    ])
  }

  function applySuggestion(suggestions: ReturnType<typeof suggestQuantityFix>) {
    setItems((prev) =>
      prev.map((item) => {
        const suggestion = suggestions.find((s) => s.itemId === item.id)
        return suggestion ? { ...item, qty: suggestion.suggestedQty } : item
      }),
    )
  }

  const draft = { items, shippingFee, vatFee, purpose }
  const excludeRequestId = existingRequest?.id
  const findings = checkRequest(team, state.requests, draft, { excludeRequestId })
  const remaining = remainingAfterDraft(team, state.requests, draft, { excludeRequestId })
  const totalAmount = sumWon(items.map(itemAmount)) + shippingFee + vatFee

  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warning')
  const infos = findings.filter((f) => f.severity === 'info')

  function ackReason(ruleId: string, itemId: string | undefined): string {
    return acknowledgements.find((a) => a.ruleId === ruleId && a.itemId === itemId)?.reason ?? ''
  }

  function setAckReason(ruleId: string, itemId: string | undefined, reason: string) {
    setAcknowledgements((prev) => {
      const rest = prev.filter((a) => !(a.ruleId === ruleId && a.itemId === itemId))
      return reason.trim().length === 0 ? rest : [...rest, { ruleId, itemId, reason }]
    })
  }

  const unacknowledgedWarning = warnings.some((w) => ackReason(w.ruleId, w.itemId).trim().length === 0)
  const canSubmit = errors.length === 0 && !unacknowledgedWarning
  const disableReason = errors.length > 0 ? '오류를 모두 해결하세요' : unacknowledgedWarning ? '경고 사유를 입력하세요' : undefined

  function handleSubmit() {
    const now = new Date().toISOString()
    const input = { teamId: team.id, purpose, items, shippingFee, vatFee, acknowledgements }
    const result = existingRequest
      ? resubmit(state, existingRequest.id, input, actor, now)
      : submit(state, input, actor, now)
    if (!result.ok) {
      setSubmitError(result.reason)
      return
    }
    onDone(result.state, result.request.id)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">
        {existingRequest ? '구매 요청 수정 후 재제출' : duplicateFrom ? '지난번 주문 다시 담기' : '새 구매 요청'}
      </h2>

      <div>
        <textarea
          data-testid="cart-input"
          className="w-full border border-slate-300 rounded p-2"
          rows={6}
          placeholder="쇼핑몰 장바구니 화면을 전체 선택해서 복사한 뒤 붙여넣으세요"
          value={cartText}
          onChange={(e) => setCartText(e.target.value)}
          onPaste={handlePaste}
        />
        <button type="button" data-testid="parse-button" className="mt-2 rounded bg-slate-600 px-3 py-1 text-white" onClick={handleParse}>
          인식
        </button>
      </div>

      {parseWarnings.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm">
          {parseWarnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span>{w.message}</span>
              {w.code === 'UNPARSED_LINE' && w.line !== undefined && (
                <>
                  <span data-testid="unparsed-line-text" className="text-slate-500">
                    {parsedLines[w.line - 1] ?? ''}
                  </span>
                  <button
                    type="button"
                    data-testid="add-unparsed-line"
                    className="rounded border border-amber-400 px-2 py-0.5"
                    onClick={() => addUnparsedLineAsItem(w.line!)}
                  >
                    품목으로 추가
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-slate-300">
            <th>연번</th>
            <th>품명</th>
            <th>규격</th>
            <th>링크</th>
            <th>수량</th>
            <th>단가</th>
            <th>금액</th>
            <th>예산 항목</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr data-testid="item-row" key={item.id} className="border-b border-slate-100">
              <td>{i + 1}</td>
              <td>
                <input value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value })} />
              </td>
              <td>
                <input value={item.spec ?? ''} onChange={(e) => updateItem(item.id, { spec: e.target.value })} />
              </td>
              <td>
                <input
                  data-testid="item-url"
                  className={item.url ? '' : 'border border-red-500'}
                  value={item.url ?? ''}
                  onChange={(e) => updateItem(item.id, { url: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) => updateItem(item.id, { qty: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                />
              </td>
              <td>{formatWon(itemAmount(item))}</td>
              <td>
                <select value={item.category} onChange={(e) => updateItem(item.id, { category: e.target.value })}>
                  {BUDGET_CATEGORIES[team.type].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button type="button" data-testid="item-delete" onClick={() => deleteItem(item.id)}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="rounded border border-slate-300 px-3 py-1" onClick={addItem}>
        행 추가
      </button>

      <div className="flex gap-4 items-center">
        <label>
          배송비{' '}
          <input
            data-testid="shipping-fee"
            type="number"
            value={shippingFee}
            onChange={(e) => setShippingFee(Number(e.target.value))}
          />
        </label>
        <span data-testid="total-amount" className="font-bold">
          합계 {formatWon(totalAmount)}
        </span>
      </div>

      <div className="rounded border border-slate-200 p-3 space-y-2">
        <h3 className="font-semibold">규정 검사</h3>
        {errors.map((f, i) => {
          const suggestions =
            f.ruleId === 'R1' && f.category
              ? suggestQuantityFix(items, f.category, -(remaining.byCategory[f.category] ?? 0))
              : []
          return (
            <div key={`e${i}`} data-testid="finding-error" className="text-red-600 border border-red-300 rounded p-1">
              <div>{f.message}</div>
              {suggestions.length > 0 && (
                <div data-testid="budget-fix-suggestion" className="mt-1 text-sm text-slate-700">
                  <span>
                    제안:{' '}
                    {suggestions
                      .map((s) => `${s.itemName} 수량 ${s.currentQty}→${s.suggestedQty}개`)
                      .join(', ')}
                    로 줄이면 ({formatWon(sumWon(suggestions.map((s) => s.reducedAmount)))} 절감)
                  </span>{' '}
                  <button
                    type="button"
                    data-testid="apply-budget-fix"
                    className="rounded border border-slate-400 px-2 py-0.5"
                    onClick={() => applySuggestion(suggestions)}
                  >
                    적용
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {warnings.map((f, i) => (
          <div key={`w${i}`} data-testid="finding-warning" className="text-amber-700 border border-amber-300 rounded p-1">
            <div>{f.message}</div>
            <input
              placeholder="사유를 입력하세요"
              value={ackReason(f.ruleId, f.itemId)}
              onChange={(e) => setAckReason(f.ruleId, f.itemId, e.target.value)}
            />
          </div>
        ))}
        {infos.map((f, i) => (
          <div key={`i${i}`} className="text-slate-600">
            {f.message}
          </div>
        ))}
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">항목</th>
              <th>이번 요청 후 잔액</th>
            </tr>
          </thead>
          <tbody>
            {BUDGET_CATEGORIES[team.type].map((c) => (
              <tr key={c}>
                <td>{c}</td>
                <td className={remaining.byCategory[c] < 0 ? 'text-red-600' : ''}>
                  {formatWon(remaining.byCategory[c] ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <input
        data-testid="purpose-input"
        className="w-full border border-slate-300 rounded p-2"
        placeholder="용도"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="submit-button"
          disabled={!canSubmit}
          className="rounded bg-sky-600 px-4 py-2 text-white disabled:bg-slate-300"
          onClick={handleSubmit}
        >
          제출
        </button>
        {disableReason && <span className="text-sm text-slate-500">{disableReason}</span>}
        {submitError && <span className="text-sm text-red-600">{submitError}</span>}
        <button type="button" className="text-sm text-slate-500" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  )
}
