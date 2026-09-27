import { useState } from 'react'
import {
  MAX_REPORT_NOTE, type ReportReason, type ReportTarget, reasonsFor, reportProblems,
} from '@shared/report.js'
import { useT } from '../i18n/I18nProvider.js'
import { api, ApiError } from '../lib/api.js'
import { useToast } from '../store/ToastContext.js'
import { Button, Choice, Notice, VoiceInput } from './ui.js'

/**
 * "THIS SHOULD NOT BE HERE."
 *
 * One sheet for every kind of report, because the shape is always the same:
 * what is wrong, in her words where the list cannot say it, and then it is
 * gone from her hands. It is deliberately NOT a conversation - she is not
 * asked to argue with a seller, and nothing is shown to the seller.
 *
 * Two screens, not one: the reason, then a plain confirmation that somebody
 * will look. Sending has to feel like it landed somewhere, or the next time
 * she sees something wrong she will not bother.
 */
export function ReportSheet({
  targetType, targetId, orderId, title, open, onClose,
}: {
  targetType: ReportTarget
  targetId: string
  /**
   * The order a buyer is being reported from. A seller may only report a
   * buyer she has dealt with, and this is what the server checks that against.
   */
  orderId?: string
  /** What she is reporting, so the sheet can name it back to her. */
  title?: string
  open: boolean
  onClose: () => void
}) {
  const t = useT()
  const { toast } = useToast()
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({})

  if (!open) return null

  function close() {
    setReason('')
    setNote('')
    setErr('')
    setFieldErr({})
    onClose()
  }

  async function send() {
    const problems = reportProblems({ reason, note }, targetType)
    setFieldErr(problems)
    if (Object.keys(problems).length) return

    setBusy(true)
    setErr('')
    try {
      await api.report({
        targetType, targetId, orderId, reason: reason as ReportReason, note: note.trim(),
      })
      toast(t('report.sent'))
      close()
    } catch (e) {
      setErr(e instanceof ApiError ? (e.messageMr ?? e.message) : t('report.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="stack">
          <div className="stack-sm">
            <h2 className="h2">{t('report.title')}</h2>
            {title && <p className="body muted">{title}</p>}
            {/* Who is not told depends on who is being reported. */}
            <p className="small dim">{t(targetType === 'customer' ? 'report.subBuyer' : 'report.sub')}</p>
          </div>

          <div className="stack-sm">
            {/* Each target has its own list: "unsafe to eat" says nothing
                about a buyer, and "never took delivery" nothing about pickle. */}
            {reasonsFor(targetType).map((r) => (
              <Choice
                key={r}
                selected={reason === r}
                onSelect={() => { setReason(r); setFieldErr({}) }}
                title={t(`report.reason.${r}`)}
              />
            ))}
          </div>

          {/* Only "other" needs words, and then it needs real ones: a queue of
              reports saying "bad" cannot be acted on by anybody. */}
          {reason === 'other' && (
            <VoiceInput
              value={note}
              onChange={setNote}
              error={!!fieldErr.note}
              maxLength={MAX_REPORT_NOTE}
              placeholder={t('report.notePlaceholder')}
              speakHint
            />
          )}
          {fieldErr.note && <div className="field__err">{fieldErr.note}</div>}
          {fieldErr.reason && <div className="field__err">{fieldErr.reason}</div>}
          {err && <Notice tone="danger">{err}</Notice>}

          <div className="stack-sm">
            <Button variant="danger" disabled={busy || !reason} onClick={() => void send()}>
              {t('report.send')}
            </Button>
            <Button variant="quiet" disabled={busy} onClick={close}>{t('common.cancel')}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The quiet link that opens it, wherever reportable content is shown. A
 * `labelKey` names what is being reported when the screen alone does not -
 * "Report" under a review is plain, beside a shop's name it is not.
 */
export function ReportLink({ onClick, labelKey = 'report.link' }: { onClick: () => void; labelKey?: string }) {
  const t = useT()
  return (
    <button type="button" className="linkbtn linkbtn--quiet" onClick={onClick}>
      {t(labelKey)}
    </button>
  )
}
