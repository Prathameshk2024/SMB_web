import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isValidUpi } from '@shared/seller.js'
import { upiProblem } from '@shared/payment.js'
import { useT } from '../../i18n/I18nProvider.js'
import { api, ApiError } from '../../lib/api.js'
import {
  AppBar, Button, Card, EmptyState, Field, Loading,
  Notice, Pill, TextInput, useAsync,
} from '../../components/ui.js'
import QrCode from '../../components/QrCode.js'
import { IconCheck, IconEdit, IconQr, IconWaiting } from '../../components/icons.js'

/**
 * SELLER PAYMENT QR — a real step, not something we pretend happened.
 *
 * Registration collects her UPI *ID*, because she cannot be paid without one.
 * It does NOT collect a QR image. So this screen is where the payment QR
 * actually gets set up, after admin approval:
 *
 *   Registration → admin approval → SHE ADDS HER PAYMENT QR HERE → customers pay
 *
 * The QR is generated from her own UPI ID rather than uploaded, which is the
 * better default: a generated code carries the exact order amount, while a
 * screenshot of her bank's QR carries none, leaving the customer to type the
 * figure by hand. She can still upload her bank's image if she prefers it.
 *
 * Until she has been through this screen, `upiQrReady` is false and every
 * surface that would show her QR shows an empty state instead. Nothing is
 * invented.
 */
export default function PaymentQr() {
  const t = useT()
  const nav = useNavigate()
  const [me, loading, setMe] = useAsync(() => api.me(), [])

  const [editing, setEditing] = useState(false)
  const [upi, setUpi] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading || !me) {
    return <><AppBar title={t('qrpay.title')} backTo="/seller/profile" /><div className="screen"><Loading /></div></>
  }

  const seller = me.seller
  const hasUpi = isValidUpi(seller.upiId)
  const ready = !!seller.upiQrReady && hasUpi

  // What a customer will scan, with no amount in it. The real code at
  // checkout is built per order with that order's total.
  const sampleLink = hasUpi ? previewLink(seller.upiId, seller.shopName) : ''

  async function saveUpi() {
    const fault = upiProblem(upi)
    if (fault) {
      setErr(fault)
      return
    }
    setBusy(true)
    try {
      const res = await api.updateMe({ upiId: upi.trim(), upiQrReady: true })
      setMe({ ...me!, seller: res.seller })
      setEditing(false)
      setErr('')
    } catch (e) {
      setErr(e instanceof ApiError ? (e.messageMr ?? e.message) : t('err.network'))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    setBusy(true)
    const res = await api.updateMe({ upiQrReady: true })
    setMe({ ...me!, seller: res.seller })
    setBusy(false)
  }

  return (
    <>
      <AppBar
        title={t('qrpay.title')}
        backTo="/seller/profile"
      />

      <div className="screen stack">
        <Notice tone="warn">{t('qrpay.lede')}</Notice>

        {/* ---------- nothing set up yet ---------------------------- */}
        {!ready && !editing && (
          <Card>
            <EmptyState
              icon={IconQr}
              title={t('qrpay.empty')}
              body={hasUpi ? t('qrpay.emptyBodyHasUpi') : t('qrpay.emptyBody')}
              action={
                <Button onClick={() => { setUpi(seller.upiId ?? ''); setEditing(!hasUpi) ; if (hasUpi) void confirm() }}>
                  {t('qrpay.add')}
                </Button>
              }
            />
          </Card>
        )}

        {/* ---------- editing her UPI ID --------------------------- */}
        {editing && (
          <Card>
            <div className="stack">
              <Field
                label={t('reg.upiLabel')}
                hint={t('reg.upiWhere')}
                error={err}
                required
                htmlFor="upi"
              >
                <TextInput
                  id="upi"
                  value={upi}
                  error={!!err}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => { setUpi(e.target.value.trim()); setErr('') }}
                  placeholder={t('reg.upiPlaceholder')}
                />
              </Field>

              {isValidUpi(upi) && (
                <>
                  <div className="center small dim">{t('qrpay.preview')}</div>
                  <QrCode
                    value={previewLink(upi, seller.shopName)}
                    label={t('qrpay.title')}
                  />
                </>
              )}

              <div className="btn-row">
                <Button variant="quiet" onClick={() => { setEditing(false); setErr('') }}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => void saveUpi()} disabled={busy || !isValidUpi(upi)}>
                  {busy ? t('common.loading') : t('common.save')}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ---------- set up and live ------------------------------ */}
        {ready && !editing && (
          <>
            <Card style={{ textAlign: 'center' }}>
              <div className="stack-sm">
                <strong style={{ fontSize: 'var(--t-md)' }}>{seller.shopName}</strong>
                <QrCode value={sampleLink} label={t('qrpay.title')} />
                <div className="small dim">{t('qrpay.sample')}</div>

                <div style={{ marginTop: 'var(--s2)' }}>
                  <span className="idpill num">{seller.upiId}</span>
                </div>

                <div>
                  <Pill tone={seller.upiVerified ? 'ok' : 'warn'} icon={seller.upiVerified ? <IconCheck /> : <IconWaiting />}>
                    {seller.upiVerified ? t('prof.verified') : t('prof.notVerified')}
                  </Pill>
                </div>
              </div>
            </Card>

            <Button variant="ghost" onClick={() => { setUpi(seller.upiId); setEditing(true) }}>
              <IconEdit aria-hidden="true" /> {t('qrpay.change')}
            </Button>
          </>
        )}

        <Card>
          <div className="small muted">{t('qrpay.how')}</div>
        </Card>

        <Button variant="quiet" onClick={() => nav('/seller/profile')}>
          {t('common.back')}
        </Button>
      </div>
    </>
  )
}

/**
 * A PREVIEW THAT CANNOT TAKE ANYBODY'S MONEY BY ITSELF.
 *
 * It used to carry a sample 100 rupees, which made it a real, payable request
 * for an amount nobody owed: scanned by mistake, it pre-fills 100 in the
 * payer's UPI app. Without `am` the payer's app asks for the amount, which is
 * exactly what her own bank's QR does. Built here rather than through
 * buildUpiLink, which always writes an amount because every other caller is
 * a real order or payment.
 */
function previewLink(upiId: string, name: string): string {
  const p = new URLSearchParams({ pa: upiId, pn: name, cu: 'INR' })
  return `upi://pay?${p.toString()}`
}
