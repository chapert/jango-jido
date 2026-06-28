import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Browser } from '@capacitor/browser'
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CircleDollarSign,
  CloudDownload,
  Download,
  Landmark,
  ListChecks,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat,
  Settings,
  ShieldCheck,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'
import './App.css'

const APP_VERSION = '0.5.6'
const UPDATE_MANIFEST_URL = 'https://moneypl-apk-vercel.vercel.app/version.json'
const FALLBACK_APK_URL = 'https://moneypl-apk-vercel.vercel.app/moneypl.apk'
const STORAGE_KEY = 'jango-jido-data-v1'
const ENABLE_NATIVE_AUTO_CAPTURE = true

type Tab = 'home' | 'record' | 'plan' | 'settings'
type EntryType = 'expense' | 'income'

type Profile = {
  currentBalance: number
  monthlyIncome: number
  payday: number
  monthlyLivingBudget: number
  safetyBuffer: number
}

type Transaction = {
  id: string
  title: string
  amount: number
  category: string
  date: string
  type: EntryType
}

type RecurringItem = {
  id: string
  title: string
  amount: number
  category: string
  day: number
  type: EntryType
  enabled: boolean
}

type Goal = {
  id: string
  title: string
  target: number
  saved: number
  dueDate: string
}

type AppData = {
  profile: Profile
  transactions: Transaction[]
  recurring: RecurringItem[]
  goals: Goal[]
}

type UpdateManifest = {
  version?: string
  apkUrl?: string
  url?: string
  name?: string
  notes?: string
}

type UpdateState =
  | { status: 'idle' | 'checking' | 'latest' | 'error'; message?: string }
  | { status: 'available'; version: string; url: string; name: string; notes?: string }

type NativeAutoCaptureItem = {
  id: string
  packageName: string
  appName: string
  title?: string
  text?: string
  bigText?: string
  subText?: string
  postedAt: number
  capturedAt: number
}

type AutoCaptureCandidate = NativeAutoCaptureItem & {
  raw: string
  merchant: string
  amount: number
  type: EntryType
  category: string
  confidence: number
}

type MoneyplAutoCapturePlugin = {
  isNotificationAccessEnabled: () => Promise<{ enabled: boolean }>
  openNotificationAccessSettings: () => Promise<void>
  getPendingNotifications: () => Promise<{ items: NativeAutoCaptureItem[] }>
  removePendingNotifications: (options: { ids: string[] }) => Promise<void>
  addListener: (
    eventName: 'notificationCaptured',
    listenerFunc: (event: { item: NativeAutoCaptureItem }) => void,
  ) => Promise<PluginListenerHandle>
}

const MoneyplAutoCapture = registerPlugin<MoneyplAutoCapturePlugin>('MoneyplAutoCapture')

type NativeAutoCaptureWindowBridge = {
  isNotificationAccessEnabled: () => string
  openNotificationAccessSettings: () => void
  getPendingNotifications: () => string
  removePendingNotifications: (optionsJson: string) => void
}

declare global {
  interface Window {
    MoneyplNativeAutoCapture?: NativeAutoCaptureWindowBridge
  }
}

function parseNativeBridgeResult<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function createAutoCaptureBridge(): MoneyplAutoCapturePlugin | null {
  if (typeof window !== 'undefined' && window.MoneyplNativeAutoCapture) {
    const native = window.MoneyplNativeAutoCapture
    return {
      isNotificationAccessEnabled: async () =>
        parseNativeBridgeResult(native.isNotificationAccessEnabled(), { enabled: false }),
      openNotificationAccessSettings: async () => {
        native.openNotificationAccessSettings()
      },
      getPendingNotifications: async () =>
        parseNativeBridgeResult(native.getPendingNotifications(), { items: [] }),
      removePendingNotifications: async (options) => {
        native.removePendingNotifications(JSON.stringify(options))
      },
      addListener: async (eventName, listenerFunc) => {
        const handler = (event: Event) => {
          if (eventName !== 'notificationCaptured') return
          const detail = (event as CustomEvent<{ item?: NativeAutoCaptureItem }>).detail
          if (detail?.item) listenerFunc({ item: detail.item })
        }
        window.addEventListener('moneypl-auto-capture', handler)
        return {
          remove: async () => window.removeEventListener('moneypl-auto-capture', handler),
        }
      },
    }
  }

  if (Capacitor.getPlatform() === 'android') {
    return MoneyplAutoCapture
  }

  return null
}

const categories = ['식비', '카페', '교통', '생활', '쇼핑', '고정비', '수입', '기타']

const tabItems: { id: Tab; label: string; icon: typeof Wallet }[] = [
  { id: 'home', label: '오늘', icon: Wallet },
  { id: 'record', label: '기록', icon: ReceiptText },
  { id: 'plan', label: '계획', icon: CalendarDays },
  { id: 'settings', label: '설정', icon: Settings },
]

function id() {
  return crypto.randomUUID()
}

function isoDate(date: Date) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIso(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), daysInMonth(date))
}

function clampDay(day: number, date: Date) {
  return Math.min(Math.max(1, day), daysInMonth(date))
}

function daysBetween(start: Date, end: Date) {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  return Math.round((endDay - startDay) / 86_400_000)
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function monthsUntil(dateIso: string, today: Date) {
  const due = parseIso(dateIso)
  const diff = (due.getFullYear() - today.getFullYear()) * 12 + due.getMonth() - today.getMonth()
  return Math.max(1, diff + 1)
}

function won(value: number) {
  const prefix = value < 0 ? '-' : ''
  return `${prefix}${Math.abs(Math.round(value)).toLocaleString('ko-KR')}원`
}

function numberValue(value: string) {
  return Number(value.replace(/[^0-9.-]/g, '')) || 0
}

function compareVersions(a: string, b: string) {
  const left = a.replace(/^v/i, '').split('.').map(Number)
  const right = b.replace(/^v/i, '').split('.').map(Number)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function autoCaptureText(item: NativeAutoCaptureItem) {
  return compact([item.title, item.text, item.bigText, item.subText].filter(Boolean).join(' '))
}

function inferAutoType(raw: string): EntryType {
  if (/입금|급여|환불|취소|송금받|받았/.test(raw)) return 'income'
  return 'expense'
}

function inferAutoCategory(raw: string, type: EntryType) {
  if (type === 'income') return '수입'
  if (/커피|카페|스타벅스|투썸|이디야|메가커피|컴포즈/.test(raw)) return '카페'
  if (/버스|지하철|택시|교통|주유|하이패스|철도|KTX/.test(raw)) return '교통'
  if (/쿠팡|쇼핑|마트|편의점|올리브영|배달|요기요|배민/.test(raw)) return '쇼핑'
  if (/통신|보험|관리비|월세|구독|자동이체/.test(raw)) return '고정비'
  if (/식당|식비|음식|분식|치킨|피자|카페테리아/.test(raw)) return '식비'
  return '기타'
}

function inferAutoMerchant(raw: string, amountText: string | undefined, appName: string) {
  const afterAmount = amountText ? raw.split(amountText).slice(1).join(amountText) : ''
  const candidate = compact(afterAmount)
    .split(/잔액|누적|승인번호|카드번호|일시불|할부|출금|입금|결제|승인|사용/)
    .map((part) =>
      compact(
        part
          .replace(/\[[^\]]+\]/g, ' ')
          .replace(/[0-9]{1,2}[./:-][0-9]{1,2}(?:[./:-][0-9]{1,2})?/g, ' ')
          .replace(/[0-9,]+\s*원/g, ' ')
          .replace(/KRW|USD|카드|체크|은행|앱|알림/g, ' '),
      ),
    )
    .find((part) => part.length >= 2)

  if (candidate) return candidate.slice(0, 24)

  const cleaned = compact(
    raw
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/[0-9,]+\s*원/g, ' ')
      .replace(/입금|출금|결제|승인|사용|잔액|누적|카드|체크|은행|알림/g, ' '),
  )
  return (cleaned || `${appName} 알림`).slice(0, 24)
}

function inferAutoCandidate(item: NativeAutoCaptureItem): AutoCaptureCandidate | null {
  const raw = autoCaptureText(item)
  const amountMatch = raw.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*원/)
  const amount = amountMatch ? numberValue(amountMatch[1]) : 0
  if (!amount) return null

  const type = inferAutoType(raw)
  const category = inferAutoCategory(raw, type)
  const merchant = inferAutoMerchant(raw, amountMatch?.[0], item.appName)
  const confidence = Math.min(0.95, 0.45 + (merchant ? 0.2 : 0) + (/(입금|출금|결제|승인|사용)/.test(raw) ? 0.2 : 0))

  return {
    ...item,
    raw,
    merchant,
    amount,
    type,
    category,
    confidence,
  }
}

function createDefaultData(): AppData {
  const today = new Date()
  return {
    profile: {
      currentBalance: 0,
      monthlyIncome: 0,
      payday: today.getDate(),
      monthlyLivingBudget: 0,
      safetyBuffer: 0,
    },
    transactions: [],
    recurring: [],
    goals: [],
  }
}

function isSeedData(data: AppData) {
  const seededProfile =
    data.profile.currentBalance === 1_850_000 &&
    data.profile.monthlyIncome === 3_200_000 &&
    data.profile.payday === 25 &&
    data.profile.monthlyLivingBudget === 950_000 &&
    data.profile.safetyBuffer === 300_000

  const seededTransactions =
    data.transactions.length === 3 &&
    data.transactions.some((entry) => entry.title === '점심' && entry.amount === 12_000) &&
    data.transactions.some((entry) => entry.title === '커피' && entry.amount === 4_800) &&
    data.transactions.some((entry) => entry.title === '중고 판매' && entry.amount === 45_000)

  const seededRecurring =
    data.recurring.length === 4 &&
    data.recurring.some((entry) => entry.title === '월세' && entry.amount === 650_000) &&
    data.recurring.some((entry) => entry.title === '통신비' && entry.amount === 69_000) &&
    data.recurring.some((entry) => entry.title === '구독료' && entry.amount === 29_000) &&
    data.recurring.some((entry) => entry.title === '보험료' && entry.amount === 84_000)

  const seededGoals =
    data.goals.length === 2 &&
    data.goals.some((entry) => entry.title === '비상금' && entry.target === 3_000_000 && entry.saved === 820_000) &&
    data.goals.some((entry) => entry.title === '여행자금' && entry.target === 1_500_000 && entry.saved === 430_000)

  return seededProfile && seededTransactions && seededRecurring && seededGoals
}

function loadData(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as AppData
      return isSeedData(parsed) ? createDefaultData() : parsed
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
  return createDefaultData()
}

function useSavedData() {
  const [data, setData] = useState<AppData>(() => loadData())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  return [data, setData] as const
}

function useFinancialPlan(data: AppData) {
  return useMemo(() => {
    const today = new Date()
    const currentDay = today.getDate()
    const end = endOfMonth(today)
    const daysLeft = Math.max(1, daysBetween(today, end) + 1)

    const thisMonthTransactions = data.transactions.filter((entry) => isSameMonth(parseIso(entry.date), today))
    const variableSpent = thisMonthTransactions
      .filter((entry) => entry.type === 'expense')
      .reduce((sum, entry) => sum + entry.amount, 0)
    const variableIncome = thisMonthTransactions
      .filter((entry) => entry.type === 'income')
      .reduce((sum, entry) => sum + entry.amount, 0)
    const remainingBudget = Math.max(0, data.profile.monthlyLivingBudget - variableSpent)

    const upcomingRecurring = data.recurring.filter((item) => item.enabled && item.day >= currentDay)
    const recurringExpenseLeft = upcomingRecurring
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0)
    const recurringIncomeLeft = upcomingRecurring
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0)

    const salaryLeft = data.profile.payday >= currentDay ? data.profile.monthlyIncome : 0
    const goalMonthlyNeed = data.goals.reduce((sum, goal) => {
      const remaining = Math.max(0, goal.target - goal.saved)
      return sum + Math.ceil(remaining / monthsUntil(goal.dueDate, today))
    }, 0)

    const spendableCash =
      data.profile.currentBalance +
      salaryLeft +
      recurringIncomeLeft -
      recurringExpenseLeft -
      goalMonthlyNeed -
      data.profile.safetyBuffer
    const budgetDaily = remainingBudget / daysLeft
    const cashDaily = spendableCash / daysLeft
    const safeDaily = Math.max(0, Math.floor(Math.min(budgetDaily, cashDaily)))
    const monthEndBalance =
      data.profile.currentBalance +
      salaryLeft +
      recurringIncomeLeft -
      recurringExpenseLeft -
      goalMonthlyNeed -
      safeDaily * daysLeft

    let balance = data.profile.currentBalance
    const points = Array.from({ length: 90 }, (_, index) => {
      const date = addDays(today, index)
      const dateDay = date.getDate()
      const dim = daysInMonth(date)

      if (dateDay === clampDay(data.profile.payday, date)) {
        balance += data.profile.monthlyIncome
      }

      data.recurring.forEach((item) => {
        if (!item.enabled) return
        if (dateDay !== clampDay(item.day, date)) return
        balance += item.type === 'income' ? item.amount : -item.amount
      })

      balance -= data.profile.monthlyLivingBudget / dim
      balance -= goalMonthlyNeed / dim

      return { date: isoDate(date), balance: Math.round(balance) }
    })

    const firstRisk = points.find((point) => point.balance < data.profile.safetyBuffer)
    const lowestPoint = points.reduce((lowest, point) => (point.balance < lowest.balance ? point : lowest), points[0])

    const categorySpend = categories
      .map((category) => ({
        category,
        amount: thisMonthTransactions
          .filter((entry) => entry.type === 'expense' && entry.category === category)
          .reduce((sum, entry) => sum + entry.amount, 0),
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    return {
      today,
      daysLeft,
      variableSpent,
      variableIncome,
      remainingBudget,
      recurringExpenseLeft,
      recurringIncomeLeft,
      salaryLeft,
      goalMonthlyNeed,
      safeDaily,
      monthEndBalance,
      firstRisk,
      lowestPoint,
      points,
      categorySpend,
    }
  }, [data])
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  suffix,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: string
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="inputWrap">
        <input
          value={value}
          type={type}
          min={min}
          max={max}
          inputMode={type === 'number' ? 'numeric' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? <em>{suffix}</em> : null}
      </div>
    </label>
  )
}

function EmptyState({ icon: Icon, title }: { icon: typeof Wallet; title: string }) {
  return (
    <div className="emptyState">
      <Icon size={20} />
      <span>{title}</span>
    </div>
  )
}

function CashflowChart({ points, safetyBuffer }: { points: { date: string; balance: number }[]; safetyBuffer: number }) {
  const width = 720
  const height = 190
  const max = Math.max(...points.map((point) => point.balance), safetyBuffer) * 1.08
  const min = Math.min(...points.map((point) => point.balance), safetyBuffer, 0) * 0.92
  const range = Math.max(1, max - min)
  const x = (index: number) => (index / Math.max(1, points.length - 1)) * width
  const y = (value: number) => height - ((value - min) / range) * height
  const line = points.map((point, index) => `${x(index)},${y(point.balance)}`).join(' ')
  const area = `${line} ${width},${height} 0,${height}`
  const safetyY = y(safetyBuffer)

  return (
    <div className="chartFrame" aria-label="90일 잔고 예측 그래프">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id="cashArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#50a3a2" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#50a3a2" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1="0" x2={width} y1={safetyY} y2={safetyY} className="safetyLine" />
        <polygon points={area} className="cashArea" />
        <polyline points={line} className="cashLine" />
      </svg>
    </div>
  )
}

function UpdateBanner({
  update,
  onCheck,
  onDownload,
}: {
  update: UpdateState
  onCheck: () => void
  onDownload: () => void
}) {
  if (update.status === 'available') {
    return (
      <section className="updateBanner">
        <div>
          <strong>새 버전 {update.version}</strong>
          <span>{update.name || 'Vercel 직접 링크로 APK를 받을 수 있어요.'}</span>
        </div>
        <button type="button" className="primary small" onClick={onDownload}>
          <CloudDownload size={16} />
          다운로드
        </button>
      </section>
    )
  }

  if (update.status === 'error') {
    return (
      <section className="updateBanner subtle">
        <div>
          <strong>업데이트 확인 실패</strong>
          <span>{update.message || '네트워크 연결 뒤 다시 확인하세요.'}</span>
        </div>
        <button type="button" className="ghost small" onClick={onCheck}>
          <RefreshCw size={16} />
          다시 확인
        </button>
      </section>
    )
  }

  return null
}

function BrandMark({ size = 52 }: { size?: number }) {
  return <img src="./brand-mark.png" width={size} height={size} alt="" aria-hidden="true" />
}

function App() {
  const [data, setData] = useSavedData()
  const plan = useFinancialPlan(data)
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })
  const [transactionForm, setTransactionForm] = useState({
    title: '',
    amount: '',
    category: '식비',
    date: isoDate(new Date()),
    type: 'expense' as EntryType,
  })
  const [recurringForm, setRecurringForm] = useState({
    title: '',
    amount: '',
    category: '고정비',
    day: '1',
    type: 'expense' as EntryType,
  })
  const [goalForm, setGoalForm] = useState({
    title: '',
    target: '',
    saved: '',
    dueDate: isoDate(addDays(new Date(), 120)),
  })
  const [scenarioAmount, setScenarioAmount] = useState('300000')
  const [topUps, setTopUps] = useState<Record<string, string>>({})
  const [notificationAccessEnabled, setNotificationAccessEnabled] = useState(false)
  const [autoCaptureItems, setAutoCaptureItems] = useState<NativeAutoCaptureItem[]>([])
  const [autoCaptureMessage, setAutoCaptureMessage] = useState('')
  const autoCaptureBridge = useMemo(() => createAutoCaptureBridge(), [])
  const isAutoCaptureReady = ENABLE_NATIVE_AUTO_CAPTURE && Boolean(autoCaptureBridge)
  const autoCaptureStatusLabel = notificationAccessEnabled ? '알림 연결됨' : '권한 연결 필요'

  const recentTransactions = [...data.transactions]
    .sort((a, b) => parseIso(b.date).getTime() - parseIso(a.date).getTime())
    .slice(0, 12)

  const scenario = useMemo(() => {
    const amount = numberValue(scenarioAmount)
    const daysLeft = plan.daysLeft
    return {
      amount,
      safeDaily: Math.max(0, Math.floor((plan.safeDaily * daysLeft - amount) / daysLeft)),
      monthEndBalance: plan.monthEndBalance - amount,
    }
  }, [plan.daysLeft, plan.monthEndBalance, plan.safeDaily, scenarioAmount])

  const autoCandidates = useMemo(
    () => autoCaptureItems.map(inferAutoCandidate).filter((candidate): candidate is AutoCaptureCandidate => Boolean(candidate)),
    [autoCaptureItems],
  )

  const refreshAutoCapture = useCallback(async (silent = false) => {
    if (!isAutoCaptureReady) {
      if (!silent) setAutoCaptureMessage('Android APK에서 사용할 수 있어요.')
      return
    }

    try {
      const [access, pending] = await Promise.all([
        autoCaptureBridge?.isNotificationAccessEnabled() || Promise.resolve({ enabled: false }),
        autoCaptureBridge?.getPendingNotifications() || Promise.resolve({ items: [] }),
      ])
      setNotificationAccessEnabled(access.enabled)
      setAutoCaptureItems(pending.items || [])
      if (!silent) {
        setAutoCaptureMessage(access.enabled ? '알림 연결됨' : '권한 필요')
      }
    } catch (error) {
      setAutoCaptureMessage(error instanceof Error ? error.message : '자동 기록을 확인하지 못했어요.')
    }
  }, [autoCaptureBridge, isAutoCaptureReady])

  useEffect(() => {
    void refreshAutoCapture(true)

    if (!isAutoCaptureReady) return undefined

    let listener: PluginListenerHandle | undefined
    void autoCaptureBridge?.addListener('notificationCaptured', (event) => {
      setAutoCaptureItems((current) => [event.item, ...current.filter((item) => item.id !== event.item.id)].slice(0, 80))
      setAutoCaptureMessage('새 후보 도착')
    })?.then((handle) => {
      listener = handle
    })

    const permissionHandler = () => {
      void refreshAutoCapture(true)
    }
    window.addEventListener('moneypl-auto-capture-permission', permissionHandler)
    const interval = window.setInterval(() => {
      void refreshAutoCapture(true)
    }, 8000)

    return () => {
      void listener?.remove()
      window.removeEventListener('moneypl-auto-capture-permission', permissionHandler)
      window.clearInterval(interval)
    }
  }, [autoCaptureBridge, isAutoCaptureReady, refreshAutoCapture])

  const checkForUpdate = async (manual = false) => {
    setUpdate({ status: 'checking' })
    try {
      const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`업데이트 서버 응답 ${response.status}`)
      const manifest = (await response.json()) as UpdateManifest
      const version = (manifest.version || '').replace(/^v/i, '')
      const url = manifest.apkUrl || manifest.url || FALLBACK_APK_URL

      if (version && url && compareVersions(version, APP_VERSION) > 0) {
        setUpdate({
          status: 'available',
          version,
          url,
          name: manifest.name || `머니플 ${version}`,
          notes: manifest.notes,
        })
        return
      }

      setUpdate({ status: 'latest', message: manual ? '현재 최신 버전입니다.' : undefined })
    } catch (error) {
      setUpdate({ status: 'error', message: error instanceof Error ? error.message : '알 수 없는 오류' })
    }
  }

  useEffect(() => {
    void checkForUpdate()
  }, [])

  const openUpdate = async () => {
    if (update.status !== 'available') return
    await Browser.open({ url: update.url })
  }

  const addTransaction = () => {
    const amount = numberValue(transactionForm.amount)
    if (!transactionForm.title.trim() || amount <= 0) return

    setData((current) => ({
      ...current,
      transactions: [
        {
          id: id(),
          title: transactionForm.title.trim(),
          amount,
          category: transactionForm.category,
          date: transactionForm.date,
          type: transactionForm.type,
        },
        ...current.transactions,
      ],
      profile: {
        ...current.profile,
        currentBalance:
          current.profile.currentBalance + (transactionForm.type === 'income' ? amount : -amount),
      },
    }))

    setTransactionForm((current) => ({ ...current, title: '', amount: '', date: isoDate(new Date()) }))
  }

  const removeAutoCandidates = async (ids: string[]) => {
    setAutoCaptureItems((current) => current.filter((item) => !ids.includes(item.id)))
    if (!isAutoCaptureReady) return
    try {
      await autoCaptureBridge?.removePendingNotifications({ ids })
    } catch {
      setAutoCaptureMessage('후보 정리에 실패했어요.')
    }
  }

  const addAutoCandidate = (candidate: AutoCaptureCandidate) => {
    setData((current) => ({
      ...current,
      transactions: [
        {
          id: id(),
          title: candidate.merchant,
          amount: candidate.amount,
          category: candidate.category,
          date: isoDate(new Date(candidate.postedAt || Date.now())),
          type: candidate.type,
        },
        ...current.transactions,
      ],
      profile: {
        ...current.profile,
        currentBalance:
          current.profile.currentBalance + (candidate.type === 'income' ? candidate.amount : -candidate.amount),
      },
    }))
    void removeAutoCandidates([candidate.id])
  }

  const openAutoCaptureSettings = async () => {
    if (!isAutoCaptureReady) {
      setAutoCaptureMessage('Android APK에서 사용할 수 있어요.')
      return
    }

    try {
      await autoCaptureBridge?.openNotificationAccessSettings()
      setAutoCaptureMessage('권한을 켜주세요')
    } catch {
      setAutoCaptureMessage('자동 기록 권한 설정을 열지 못했어요.')
    }
  }

  const addRecurring = () => {
    const amount = numberValue(recurringForm.amount)
    const day = Math.min(31, Math.max(1, numberValue(recurringForm.day)))
    if (!recurringForm.title.trim() || amount <= 0) return

    setData((current) => ({
      ...current,
      recurring: [
        ...current.recurring,
        {
          id: id(),
          title: recurringForm.title.trim(),
          amount,
          category: recurringForm.category,
          day,
          type: recurringForm.type,
          enabled: true,
        },
      ],
    }))
    setRecurringForm((current) => ({ ...current, title: '', amount: '' }))
  }

  const addGoal = () => {
    const target = numberValue(goalForm.target)
    const saved = numberValue(goalForm.saved)
    if (!goalForm.title.trim() || target <= 0) return

    setData((current) => ({
      ...current,
      goals: [
        ...current.goals,
        { id: id(), title: goalForm.title.trim(), target, saved: Math.min(saved, target), dueDate: goalForm.dueDate },
      ],
    }))
    setGoalForm({ title: '', target: '', saved: '', dueDate: isoDate(addDays(new Date(), 120)) })
  }

  const updateProfile = (key: keyof Profile, value: number) => {
    setData((current) => ({ ...current, profile: { ...current.profile, [key]: value } }))
  }

  const deleteTransaction = (transaction: Transaction) => {
    setData((current) => ({
      ...current,
      transactions: current.transactions.filter((entry) => entry.id !== transaction.id),
      profile: {
        ...current.profile,
        currentBalance:
          current.profile.currentBalance + (transaction.type === 'expense' ? transaction.amount : -transaction.amount),
      },
    }))
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `moneypl-backup-${isoDate(new Date())}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (file?: File) => {
    if (!file) return
    const text = await file.text()
    const imported = JSON.parse(text) as AppData
    setData(imported)
  }

  const renderHome = () => {
    const isSafe = plan.monthEndBalance >= data.profile.safetyBuffer
    const statusText = isSafe ? '안전권' : '방어 필요'
    const budgetRatio = data.profile.monthlyLivingBudget > 0
      ? Math.min(100, (plan.variableSpent / data.profile.monthlyLivingBudget) * 100)
      : 0
    const today = isoDate(new Date())
    const todaySpent = data.transactions
      .filter((entry) => entry.type === 'expense' && entry.date === today)
      .reduce((sum, entry) => sum + entry.amount, 0)
    const latestAutoCandidate = autoCandidates[0]

    return (
      <main className="screen homeScreen">
        <UpdateBanner update={update} onCheck={() => void checkForUpdate(true)} onDownload={openUpdate} />

        <section className={`todayHero ${isSafe ? 'safe' : 'risk'}`}>
          <div className="heroTop">
            <span className="eyebrow">
              <ShieldCheck size={16} />
              {statusText}
            </span>
            <span className="pill">{plan.daysLeft}일 남음</span>
          </div>
          <p className="heroLabel">오늘 예산</p>
          <strong className="safeAmount">{won(plan.safeDaily)}</strong>
          <p className="heroHint">고정비·목표·안전잔고 반영</p>

          <div className="heroStats">
            <div>
              <span>현재 잔고</span>
              <strong>{won(data.profile.currentBalance)}</strong>
            </div>
            <div>
              <span>월말 예상</span>
              <strong className={isSafe ? '' : 'dangerText'}>{won(plan.monthEndBalance)}</strong>
            </div>
          </div>
        </section>

        <section className="quickCard">
          <div className="sectionHeader">
            <h2>바로 기록</h2>
            <span>오늘 {won(todaySpent)}</span>
          </div>
            <div className="quickForm">
              <input
                value={transactionForm.title}
                placeholder="예: 커피, 점심"
                onChange={(event) => setTransactionForm((current) => ({ ...current, title: event.target.value }))}
              />
              <input
                value={transactionForm.amount}
                placeholder="금액"
                inputMode="numeric"
                onChange={(event) => setTransactionForm((current) => ({ ...current, amount: event.target.value }))}
              />
              <button type="button" className="primary" onClick={addTransaction}>
                <Plus size={17} />
                기록
              </button>
            </div>
            <div className="chipRow">
              {['4500', '12000', '30000', '50000'].map((amount) => (
                <button
                  type="button"
                  className="chip"
                  key={amount}
                  onClick={() => setTransactionForm((current) => ({ ...current, amount }))}
                >
                  {won(Number(amount))}
                </button>
              ))}
            </div>
        </section>

        {latestAutoCandidate ? (
          <section className="sectionBlock autoBrief">
            <div>
              <span className="eyebrow muted">
                <Bell size={15} />
                자동 후보
              </span>
              <h2>{latestAutoCandidate.merchant}</h2>
              <p>{latestAutoCandidate.appName} · {latestAutoCandidate.category}</p>
            </div>
            <div className="autoBriefAction">
              <strong className={latestAutoCandidate.type === 'income' ? 'incomeText' : ''}>
                {latestAutoCandidate.type === 'income' ? '+' : '-'}{won(latestAutoCandidate.amount)}
              </strong>
              <button type="button" className="primary small" onClick={() => addAutoCandidate(latestAutoCandidate)}>
                기록
              </button>
            </div>
          </section>
        ) : (
          <section className="sectionBlock autoBrief">
            <div>
              <span className="eyebrow muted">
                <Bell size={15} />
                자동 기록
              </span>
              <h2>{notificationAccessEnabled ? '후보 대기 중' : '알림 연결'}</h2>
              <p>{notificationAccessEnabled ? '새 내역이 오면 표시됩니다.' : '은행·카드 알림 후보 수집'}</p>
            </div>
            <button type="button" className={notificationAccessEnabled ? 'secondary small' : 'primary small'} onClick={openAutoCaptureSettings}>
              권한 연결
            </button>
          </section>
        )}

        <section className="summaryGrid">
          <article className="metric">
            <span>생활비 남음</span>
            <strong>{won(plan.remainingBudget)}</strong>
            <div className="progressTrack">
              <span style={{ width: `${budgetRatio}%` }} />
            </div>
          </article>
          <article className="metric">
            <span>남은 고정비</span>
            <strong>{won(plan.recurringExpenseLeft)}</strong>
            <small>이번 달</small>
          </article>
          <article className="metric">
            <span>목표저축</span>
            <strong>{won(plan.goalMonthlyNeed)}</strong>
            <small>월 필요</small>
          </article>
          <article className="metric">
            <span>90일 위험</span>
            <strong>{plan.firstRisk ? parseIso(plan.firstRisk.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '없음'}</strong>
            <small>최저 {won(plan.lowestPoint.balance)}</small>
          </article>
        </section>

        <section className="sectionBlock recentBlock">
          <div className="sectionHeader">
            <div>
              <span className="eyebrow muted">
                <ReceiptText size={15} />
                최근 내역
              </span>
              <h2>최근 기록</h2>
            </div>
            <button type="button" className="ghost small" onClick={() => setActiveTab('record')}>
              전체
            </button>
          </div>
          <div className="list">
            {recentTransactions.slice(0, 4).length ? (
              recentTransactions.slice(0, 4).map((entry) => (
                <div className="rowItem" key={entry.id}>
                  <div className={`rowIcon ${entry.type}`}>
                    {entry.type === 'income' ? <CircleDollarSign size={18} /> : <ReceiptText size={18} />}
                  </div>
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.category} · {parseIso(entry.date).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <em className={entry.type === 'income' ? 'incomeText' : ''}>
                    {entry.type === 'income' ? '+' : '-'}{won(entry.amount)}
                  </em>
                </div>
              ))
            ) : (
              <EmptyState icon={ReceiptText} title="아직 기록이 없어요" />
            )}
          </div>
        </section>
      </main>
    )
  }

  const renderRecord = () => (
    <main className="screen">
      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <ReceiptText size={15} />
              직접 입력
            </span>
            <h2>수입·지출 기록</h2>
          </div>
        </div>

        <div className="segmented">
          {(['expense', 'income'] as EntryType[]).map((type) => (
            <button
              type="button"
              key={type}
              className={transactionForm.type === type ? 'active' : ''}
              onClick={() => setTransactionForm((current) => ({ ...current, type, category: type === 'income' ? '수입' : '식비' }))}
            >
              {type === 'expense' ? '지출' : '수입'}
            </button>
          ))}
        </div>

        <div className="formGrid">
          <Field label="내용" value={transactionForm.title} onChange={(value) => setTransactionForm((current) => ({ ...current, title: value }))} />
          <Field label="금액" value={transactionForm.amount} type="number" suffix="원" onChange={(value) => setTransactionForm((current) => ({ ...current, amount: value }))} />
          <label className="field">
            <span>카테고리</span>
            <select
              value={transactionForm.category}
              onChange={(event) => setTransactionForm((current) => ({ ...current, category: event.target.value }))}
            >
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <Field label="날짜" value={transactionForm.date} type="date" onChange={(value) => setTransactionForm((current) => ({ ...current, date: value }))} />
        </div>
        <button type="button" className="primary full" onClick={addTransaction}>
          <Plus size={18} />
          기록 추가
        </button>
      </section>

      <section className="sectionBlock autoCaptureBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <Bell size={15} />
              자동 후보
            </span>
            <h2>알림 후보</h2>
          </div>
          <span className="pill">{autoCandidates.length}건</span>
        </div>

        <div className="buttonRow autoCaptureControls">
          <button type="button" className="secondary" onClick={() => void refreshAutoCapture()}>
            <RefreshCw size={17} />
            새로고침
          </button>
          <button type="button" className={notificationAccessEnabled ? 'ghost' : 'primary'} onClick={openAutoCaptureSettings}>
            <Bell size={17} />
            권한 연결
          </button>
        </div>
        {autoCaptureMessage ? <p className="statusText">{autoCaptureMessage}</p> : null}

        <div className="autoCandidateList">
          {autoCandidates.length ? (
            autoCandidates.map((candidate) => (
              <article className="autoCandidate" key={candidate.id}>
                <div className="autoCandidateMain">
                  <div>
                    <strong>{candidate.merchant}</strong>
                    <span>{candidate.appName} · {new Date(candidate.postedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <em className={candidate.type === 'income' ? 'incomeText' : ''}>
                    {candidate.type === 'income' ? '+' : '-'}{won(candidate.amount)}
                  </em>
                </div>
                <p>{candidate.raw}</p>
                <div className="autoCandidateActions">
                  <span>{candidate.category} · {Math.round(candidate.confidence * 100)}%</span>
                  <div className="buttonRow">
                    <button type="button" className="primary small" onClick={() => addAutoCandidate(candidate)}>
                      <Plus size={15} />
                      기록
                    </button>
                    <button type="button" className="ghost small" onClick={() => void removeAutoCandidates([candidate.id])}>
                      제외
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState icon={Bell} title="후보 없음" />
          )}
        </div>
      </section>

      <section className="split">
        <article className="sectionBlock">
          <div className="sectionHeader">
            <h2>최근 기록</h2>
            <span className="pill">{data.transactions.length}건</span>
          </div>
          <div className="list">
            {recentTransactions.length ? (
              recentTransactions.map((entry) => (
                <div className="rowItem" key={entry.id}>
                  <div className={`rowIcon ${entry.type}`}>
                    {entry.type === 'income' ? <CircleDollarSign size={18} /> : <ReceiptText size={18} />}
                  </div>
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.category} · {parseIso(entry.date).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <em className={entry.type === 'income' ? 'incomeText' : ''}>
                    {entry.type === 'income' ? '+' : '-'}{won(entry.amount)}
                  </em>
                  <button type="button" className="iconButton" onClick={() => deleteTransaction(entry)} aria-label={`${entry.title} 삭제`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <EmptyState icon={ReceiptText} title="아직 기록이 없어요" />
            )}
          </div>
        </article>

        <article className="sectionBlock">
          <div className="sectionHeader">
            <h2>지출 분포</h2>
          </div>
          <div className="categoryList">
            {plan.categorySpend.length ? (
              plan.categorySpend.map((item) => (
                <div key={item.category} className="categoryRow">
                  <div>
                    <span>{item.category}</span>
                    <strong>{won(item.amount)}</strong>
                  </div>
                  <div className="progressTrack">
                    <span style={{ width: `${Math.min(100, (item.amount / Math.max(1, plan.variableSpent)) * 100)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={BarChart3} title="지출 데이터 없음" />
            )}
          </div>
        </article>
      </section>
    </main>
  )

  const renderPlan = () => (
    <main className="screen planScreen">
      <section className="planStrip">
        <article>
          <span>남은 고정비</span>
          <strong>{won(plan.recurringExpenseLeft)}</strong>
        </article>
        <article>
          <span>월 목표저축</span>
          <strong>{won(plan.goalMonthlyNeed)}</strong>
        </article>
        <article>
          <span>90일 최저</span>
          <strong className={plan.lowestPoint.balance < data.profile.safetyBuffer ? 'dangerText' : ''}>
            {won(plan.lowestPoint.balance)}
          </strong>
        </article>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <Repeat size={15} />
              고정 돈 흐름
            </span>
            <h2>반복 지출·수입</h2>
          </div>
        </div>

        <div className="formGrid">
          <Field label="이름" value={recurringForm.title} onChange={(value) => setRecurringForm((current) => ({ ...current, title: value }))} />
          <Field label="금액" value={recurringForm.amount} type="number" suffix="원" onChange={(value) => setRecurringForm((current) => ({ ...current, amount: value }))} />
          <Field label="매월 날짜" value={recurringForm.day} type="number" min={1} max={31} suffix="일" onChange={(value) => setRecurringForm((current) => ({ ...current, day: value }))} />
          <label className="field">
            <span>종류</span>
            <select
              value={recurringForm.type}
              onChange={(event) => setRecurringForm((current) => ({ ...current, type: event.target.value as EntryType }))}
            >
              <option value="expense">지출</option>
              <option value="income">수입</option>
            </select>
          </label>
        </div>
        <button type="button" className="primary full" onClick={addRecurring}>
          <Plus size={18} />
          추가
        </button>

        <div className="list recurringList">
          {data.recurring.length ? (
            data.recurring.map((item) => (
              <div className="rowItem" key={item.id}>
                <div className={`rowIcon ${item.type}`}>
                  <Repeat size={17} />
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <span>매월 {item.day}일 · {item.category}</span>
                </div>
                <em className={item.type === 'income' ? 'incomeText' : ''}>
                  {item.type === 'income' ? '+' : '-'}{won(item.amount)}
                </em>
                <button
                  type="button"
                  className="toggle"
                  aria-label={`${item.title} 활성화`}
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      recurring: current.recurring.map((entry) =>
                        entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry,
                      ),
                    }))
                  }
                >
                  <span className={item.enabled ? 'on' : ''} />
                </button>
                <button
                  type="button"
                  className="iconButton"
                  aria-label={`${item.title} 삭제`}
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      recurring: current.recurring.filter((entry) => entry.id !== item.id),
                    }))
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <EmptyState icon={Repeat} title="고정 항목 없음" />
          )}
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <Target size={15} />
              목표
            </span>
            <h2>저축 목표</h2>
          </div>
        </div>
        <div className="formGrid">
          <Field label="목표 이름" value={goalForm.title} onChange={(value) => setGoalForm((current) => ({ ...current, title: value }))} />
          <Field label="목표 금액" value={goalForm.target} type="number" suffix="원" onChange={(value) => setGoalForm((current) => ({ ...current, target: value }))} />
          <Field label="현재 모은 돈" value={goalForm.saved} type="number" suffix="원" onChange={(value) => setGoalForm((current) => ({ ...current, saved: value }))} />
          <Field label="목표 날짜" value={goalForm.dueDate} type="date" onChange={(value) => setGoalForm((current) => ({ ...current, dueDate: value }))} />
        </div>
        <button type="button" className="secondary full" onClick={addGoal}>
          <Plus size={18} />
          추가
        </button>

        <div className="goalsGrid">
          {data.goals.length ? (
            data.goals.map((goal) => {
              const progress = Math.min(100, (goal.saved / Math.max(1, goal.target)) * 100)
              const monthlyNeed = Math.ceil(Math.max(0, goal.target - goal.saved) / monthsUntil(goal.dueDate, new Date()))
              return (
                <article className="goalItem" key={goal.id}>
                  <div className="sectionHeader">
                    <div>
                      <h2>{goal.title}</h2>
                      <span>{parseIso(goal.dueDate).toLocaleDateString('ko-KR')}까지</span>
                    </div>
                    <button
                      type="button"
                      className="iconButton"
                      aria-label={`${goal.title} 삭제`}
                      onClick={() =>
                        setData((current) => ({
                          ...current,
                          goals: current.goals.filter((entry) => entry.id !== goal.id),
                        }))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <strong className="goalAmount">{won(goal.saved)} / {won(goal.target)}</strong>
                  <div className="progressTrack large">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="goalMeta">
                    <span>{progress.toFixed(0)}%</span>
                    <span>월 {won(monthlyNeed)}</span>
                  </div>
                  <div className="topUpRow">
                    <input
                      value={topUps[goal.id] || ''}
                      placeholder="저축 반영"
                      inputMode="numeric"
                      onChange={(event) => setTopUps((current) => ({ ...current, [goal.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        const amount = numberValue(topUps[goal.id] || '')
                        if (amount <= 0) return
                        setData((current) => ({
                          ...current,
                          goals: current.goals.map((entry) =>
                            entry.id === goal.id ? { ...entry, saved: Math.min(entry.target, entry.saved + amount) } : entry,
                          ),
                          profile: { ...current.profile, currentBalance: current.profile.currentBalance - amount },
                        }))
                        setTopUps((current) => ({ ...current, [goal.id]: '' }))
                      }}
                    >
                      반영
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <EmptyState icon={Target} title="목표 없음" />
          )}
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <BarChart3 size={15} />
              전망
            </span>
            <h2>90일 잔고</h2>
          </div>
          <span className="pill">최저 {won(plan.lowestPoint.balance)}</span>
        </div>
        <CashflowChart points={plan.points} safetyBuffer={data.profile.safetyBuffer} />
        <div className="forecastList">
          {plan.points
            .filter((_, index) => index % 14 === 0 || index === 89)
            .slice(0, 8)
            .map((point) => (
              <div className="forecastRow" key={point.date}>
                <span>{parseIso(point.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                <strong className={point.balance < data.profile.safetyBuffer ? 'dangerText' : ''}>
                  {won(point.balance)}
                </strong>
              </div>
            ))}
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <AlertTriangle size={15} />
              계산
            </span>
            <h2>큰 소비 체크</h2>
          </div>
        </div>
        <div className="scenarioBox">
          <Field label="예상 소비" value={scenarioAmount} type="number" suffix="원" onChange={setScenarioAmount} />
          <div className="scenarioResult">
            <span>소비 후 오늘 기준</span>
            <strong>{won(scenario.safeDaily)}</strong>
            <small>월말 예상 {won(scenario.monthEndBalance)}</small>
          </div>
        </div>
      </section>
    </main>
  )

  const renderSettings = () => (
    <main className="screen">
      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <Landmark size={15} />
              기본값
            </span>
            <h2>돈 설정</h2>
          </div>
        </div>
        <div className="formGrid">
          <Field label="현재 잔고" value={data.profile.currentBalance} type="number" suffix="원" onChange={(value) => updateProfile('currentBalance', numberValue(value))} />
          <Field label="월수입" value={data.profile.monthlyIncome} type="number" suffix="원" onChange={(value) => updateProfile('monthlyIncome', numberValue(value))} />
          <Field label="월급일" value={data.profile.payday} type="number" min={1} max={31} suffix="일" onChange={(value) => updateProfile('payday', Math.min(31, Math.max(1, numberValue(value))))} />
          <Field label="월 생활비 예산" value={data.profile.monthlyLivingBudget} type="number" suffix="원" onChange={(value) => updateProfile('monthlyLivingBudget', numberValue(value))} />
          <Field label="안전잔고" value={data.profile.safetyBuffer} type="number" suffix="원" onChange={(value) => updateProfile('safetyBuffer', numberValue(value))} />
        </div>
      </section>

      <section className="split">
        <article className="sectionBlock compact">
          <div className="sectionHeader">
            <div>
              <h2>자동 기록</h2>
              <span>{autoCaptureStatusLabel}</span>
            </div>
            <Bell size={18} />
          </div>
          <p className="softText">은행·카드 알림 후보를 폰 안에만 저장합니다.</p>
          <div className="buttonRow">
            <button type="button" className={notificationAccessEnabled ? 'secondary' : 'primary'} onClick={openAutoCaptureSettings}>
              <Bell size={17} />
              권한 연결
            </button>
            <button type="button" className="secondary" onClick={() => void refreshAutoCapture()}>
              <RefreshCw size={17} />
              상태 확인
            </button>
          </div>
          {autoCaptureMessage ? <p className="statusText">{autoCaptureMessage}</p> : null}
        </article>

        <article className="sectionBlock compact">
          <div className="sectionHeader">
            <h2>업데이트</h2>
            <span className="pill">v{APP_VERSION}</span>
          </div>
          <p className="softText">새 APK를 바로 받을 수 있습니다.</p>
          <div className="buttonRow">
            <button type="button" className="secondary" onClick={() => void checkForUpdate(true)}>
              <RefreshCw size={17} />
              확인
            </button>
            {update.status === 'available' ? (
              <button type="button" className="primary" onClick={openUpdate}>
                <Download size={17} />
                APK 받기
              </button>
            ) : null}
          </div>
          {update.status === 'latest' && update.message ? <p className="statusText">{update.message}</p> : null}
        </article>

        <article className="sectionBlock compact">
          <div className="sectionHeader">
            <h2>백업</h2>
            <ListChecks size={18} />
          </div>
          <p className="softText">데이터를 JSON으로 저장합니다.</p>
          <div className="buttonRow">
            <button type="button" className="secondary" onClick={exportData}>
              <Download size={17} />
              내보내기
            </button>
            <label className="secondary fileButton">
              불러오기
              <input type="file" accept="application/json" onChange={(event) => void importData(event.target.files?.[0])} />
            </label>
            <button type="button" className="ghost" onClick={() => setData(createDefaultData())}>
              전체 초기화
            </button>
          </div>
        </article>
      </section>
    </main>
  )

  const screens: Record<Tab, ReactElement> = {
    home: renderHome(),
    record: renderRecord(),
    plan: renderPlan(),
    settings: renderSettings(),
  }

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="brand">
          <div className="brandMark">
            <BrandMark />
          </div>
          <div>
            <strong>머니플</strong>
            <span>{tabItems.find((item) => item.id === activeTab)?.label}</span>
          </div>
        </div>
        <button type="button" className="updateButton" onClick={() => void checkForUpdate(true)}>
          <RefreshCw size={16} />
          <span>{update.status === 'checking' ? '확인 중' : '업데이트'}</span>
        </button>
      </header>

      {screens[activeTab]}

      <nav className="bottomNav" aria-label="하단 메뉴">
        {tabItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              type="button"
              key={item.id}
              className={activeTab === item.id ? 'active' : ''}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default App
