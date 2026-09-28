import { useState } from 'react'
import { phoneInput } from '@shared/seller.js'
import { useT } from '../i18n/I18nProvider.js'
import { api, type ReportedBuyer } from '../lib/api.js'
import { when } from '../lib/format.js'
import { Confirm, useConfirm } from './Confirm.js'
import { Button, Card, EmptyState, ErrorNote, Loading, Pill, SectionTitle, useAsync, useErrorText } from './ui.js'
import { useToast } from '../store/ToastContext.js'

/**
 * BUYERS, AS THE DESK SEES THEM.
 *
 * A buyer has no page in the console - she is her phone number - so what
 * sellers have reported about her, and the one thing an admin can do about
 * it, live here on the Complaints screen beside the buyer-close card.
 *
 * Blocking is keyed on the number and survives a close, because closing an
 * account is not a ban: her row is rebuilt from her number the moment she
 * signs in again. The dialog says so. Nobody is blocked on one report; the
 * intro says to ring the seller first, and the reports are grouped by buyer
 * so "three sellers, three different orders" is visible as such.
 */
export function ReportedBuyers({ version, onChanged }: { version: number; onChanged: () => void }) {
  const t = useT()
  const [data, loading, error] = useAsync(() => api.reportedBuyers(), [version])
  const rows = data?.buyers ?? []

  return (
    <Card>
      <SectionTitle>{t('rb.title')}{data?.reportedCount ? ` (${data.reportedCount})` : ''}</SectionTitle>
      <p className="small dim" style={{ marginTop: 0 }}>{t('rb.sub')}</p>
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title={t('rb.empty')} />
      ) : (
        <div className="stack-sm">
          {rows.map((b) => <BuyerRow key={b.customerId} buyer={b} onDone={onChanged} />)}
        </div>
      )}
    </Card>
  )
}

function BuyerRow({ buyer, onDone }: { buyer: ReportedBuyer; onDone: () => void }) {
  const t = useT()
  const { toast } = useToast()
  const errorText = useErrorText()
  const [busy, setBusy] = useState(false)

  async function clear() {
    setBusy(true)
    try {
      await api.clearCustomerReports(buyer.customerId)
      toast(t('rp.cleared'))
      onDone()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack-sm" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
      <div className="row wrap" style={{ gap: 8, alignItems: 'baseline' }}>
        <span className="strong">{buyer.name}</span>
        {buyer.phone && <span className="mono small dim">+91 {buyer.phone}</span>}
        <Pill tone="danger">{t('rb.count', { n: buyer.reports.length })}</Pill>
        {buyer.blocked && <Pill tone="warn">{t('rb.blocked')}</Pill>}
      </div>

      {/* Each report with its reason and the order it came from. The order
          id is what the desk asks the seller about before deciding. */}
      <ul className="reportlist">
        {buyer.reports.map((r) => (
          <li key={r.id}>
            {t(`report.reason.${r.reason}`)}
            {r.note && <> — {r.note}</>}
            {r.orderId && <span className="mono small dim"> · {t('rp.fromOrder')} {r.orderId}</span>}
            <span className="dim-2 small"> · {when(r.at)}</span>
          </li>
        ))}
      </ul>
      {buyer.blocked && buyer.blockReason && (
        <div className="small" style={{ color: 'var(--danger)' }}>{t('c.reason')}: {buyer.blockReason}</div>
      )}

      <div className="row wrap" style={{ gap: 8 }}>
        {buyer.phone && (
          <a className="btn btn--quiet btn--sm" href={`tel:+91${buyer.phone}`}>
            {t('cm.call')} +91 {buyer.phone}
          </a>
        )}
        <Button variant="quiet" small disabled={busy} onClick={() => void clear()}>{t('rp.clear')}</Button>
        <BlockButton phone={buyer.phone} blocked={buyer.blocked} onDone={onDone} />
      </div>
    </div>
  )
}

/**
 * The block, with its consequence stated and a reason required. Used on a
 * reported buyer's row and, with a typed number, for a buyer nobody has
 * reported in the app - the complaint that came by phone.
 */
export function BlockButton({
  phone, blocked, onDone, askPhone,
}: {
  phone: string
  blocked: boolean
  onDone: () => void
  /** No number known yet: the dialog asks for it. */
  askPhone?: boolean
}) {
  const t = useT()
  const { toast } = useToast()
  const errorText = useErrorText()
  const c = useConfirm()
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')

  const number = askPhone ? typed : phone

  function reset() {
    setReason('')
    setTyped('')
    c.close()
  }

  async function run() {
    if (!blocked && !reason.trim()) {
      c.setError(t('rb.blockReasonRequired'))
      return
    }
    c.setBusy(true)
    c.setError('')
    try {
      await api.blockCustomer({ phone: number, blocked: !blocked, reason: reason.trim() || undefined })
      toast(t(blocked ? 'rb.unblockedOk' : 'rb.blockedOk'))
      reset()
      onDone()
    } catch (e) {
      c.setError(errorText(e))
    } finally {
      c.setBusy(false)
    }
  }

  return (
    <>
      {!c.open && (
        <Button variant={blocked ? 'ok' : 'danger'} small disabled={!askPhone && !phone} onClick={c.ask}>
          {askPhone ? t('rb.byNumberOpen') : blocked ? t('rb.unblock') : t('rb.block')}
        </Button>
      )}
      <Confirm
        open={c.open}
        title={t(blocked ? 'rb.unblockTitle' : 'rb.blockTitle')}
        description={t(blocked ? 'rb.unblockDesc' : 'rb.blockDesc')}
        confirmLabel={t(blocked ? 'rb.unblockConfirm' : 'rb.blockConfirm')}
        tone={blocked ? 'primary' : 'danger'}
        busy={c.busy}
        error={c.error}
        onCancel={reset}
        onConfirm={() => void run()}
      >
        {askPhone && (
          <div style={{ marginTop: 10 }}>
            <label className="field__l">{t('rb.phone')}</label>
            <input
              className="input mono"
              inputMode="numeric"
              maxLength={16}
              value={typed}
              onChange={(e) => setTyped(phoneInput(e.target.value))}
            />
          </div>
        )}
        {!blocked && (
          <div style={{ marginTop: 10 }}>
            <label className="field__l">{t('rb.blockReason')}</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
      </Confirm>
    </>
  )
}

/** For the buyer nobody reported in the app: the complaint that came by phone. */
export function BlockByNumberCard({ onChanged }: { onChanged: () => void }) {
  const t = useT()
  return (
    <Card>
      <SectionTitle>{t('rb.byNumberTitle')}</SectionTitle>
      <p className="small dim" style={{ marginTop: 0 }}>{t('rb.byNumberSub')}</p>
      <BlockButton phone="" blocked={false} askPhone onDone={onChanged} />
    </Card>
  )
}

/**
 * Every blocked number, whether it came from a report or was typed in. A
 * number blocked by typing was never reported, so it appears nowhere else,
 * and this is where its block is seen and lifted.
 */
export function BlockedBuyers({ version, onChanged }: { version: number; onChanged: () => void }) {
  const t = useT()
  const [data, loading, error] = useAsync(() => api.blockedBuyers(), [version])
  const rows = data?.buyers ?? []

  return (
    <Card>
      <SectionTitle>{t('rb.blockedTitle')}{rows.length ? ` (${rows.length})` : ''}</SectionTitle>
      <p className="small dim" style={{ marginTop: 0 }}>{t('rb.blockedSub')}</p>
      <ErrorNote error={error} />
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title={t('rb.blockedEmpty')} />
      ) : (
        <div className="stack-sm">
          {rows.map((b) => (
            <div key={b.customerId} className="stack-sm" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <div className="row wrap" style={{ gap: 8, alignItems: 'baseline' }}>
                {b.name && <span className="strong">{b.name}</span>}
                <span className="mono">+91 {b.phone}</span>
                <Pill tone="warn">{t('rb.blocked')}</Pill>
                {b.blockedAt && <span className="dim-2 small">{when(b.blockedAt)}</span>}
              </div>
              {b.blockReason && (
                <div className="small" style={{ color: 'var(--danger)' }}>{t('c.reason')}: {b.blockReason}</div>
              )}
              {b.blockedBy && <div className="small dim">{t('rb.blockedBy', { who: b.blockedBy })}</div>}
              <div className="row wrap" style={{ gap: 8 }}>
                <BlockButton phone={b.phone} blocked onDone={onChanged} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
