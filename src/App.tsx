import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Browser } from '@capacitor/browser'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
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

const APP_VERSION = '0.3.1'
const REPO_OWNER = 'chapert'
const REPO_NAME = 'jango-jido'
const RELEASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
const STORAGE_KEY = 'jango-jido-data-v1'

type Tab = 'home' | 'record' | 'plan' | 'goals' | 'settings'
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

type ReleaseInfo = {
  tag_name?: string
  html_url?: string
  name?: string
  body?: string
  assets?: { name: string; browser_download_url: string }[]
}

type UpdateState =
  | { status: 'idle' | 'checking' | 'latest' | 'error'; message?: string }
  | { status: 'available'; version: string; url: string; name: string; notes?: string }

const categories = ['식비', '카페', '교통', '생활', '쇼핑', '고정비', '수입', '기타']

const tabItems: { id: Tab; label: string; icon: typeof Wallet }[] = [
  { id: 'home', label: '홈', icon: Wallet },
  { id: 'record', label: '기록', icon: ReceiptText },
  { id: 'plan', label: '계획', icon: CalendarDays },
  { id: 'goals', label: '목표', icon: Target },
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

function createDefaultData(): AppData {
  const today = new Date()
  return {
    profile: {
      currentBalance: 1_850_000,
      monthlyIncome: 3_200_000,
      payday: 25,
      monthlyLivingBudget: 950_000,
      safetyBuffer: 300_000,
    },
    transactions: [
      {
        id: id(),
        title: '점심',
        amount: 12_000,
        category: '식비',
        date: isoDate(addDays(today, -1)),
        type: 'expense',
      },
      {
        id: id(),
        title: '커피',
        amount: 4_800,
        category: '카페',
        date: isoDate(today),
        type: 'expense',
      },
      {
        id: id(),
        title: '중고 판매',
        amount: 45_000,
        category: '수입',
        date: isoDate(addDays(today, -3)),
        type: 'income',
      },
    ],
    recurring: [
      { id: id(), title: '월세', amount: 650_000, category: '고정비', day: 5, type: 'expense', enabled: true },
      { id: id(), title: '통신비', amount: 69_000, category: '고정비', day: 12, type: 'expense', enabled: true },
      { id: id(), title: '구독료', amount: 29_000, category: '고정비', day: 18, type: 'expense', enabled: true },
      { id: id(), title: '보험료', amount: 84_000, category: '고정비', day: 20, type: 'expense', enabled: true },
    ],
    goals: [
      { id: id(), title: '비상금', target: 3_000_000, saved: 820_000, dueDate: isoDate(addDays(today, 180)) },
      { id: id(), title: '여행자금', target: 1_500_000, saved: 430_000, dueDate: isoDate(addDays(today, 120)) },
    ],
  }
}

function loadData(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as AppData
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
          <span>{update.name || 'GitHub 릴리즈에서 APK를 받을 수 있어요.'}</span>
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
  return <img src="/brand-mark.png" width={size} height={size} alt="" aria-hidden="true" />
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

  const checkForUpdate = async (manual = false) => {
    setUpdate({ status: 'checking' })
    try {
      const response = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
      if (!response.ok) throw new Error(`GitHub 응답 ${response.status}`)
      const release = (await response.json()) as ReleaseInfo
      const version = (release.tag_name || '').replace(/^v/i, '')
      const apk = release.assets?.find((asset) => asset.name.toLowerCase().endsWith('.apk'))
      const url = apk?.browser_download_url || release.html_url

      if (version && url && compareVersions(version, APP_VERSION) > 0) {
        setUpdate({
          status: 'available',
          version,
          url,
          name: release.name || `머니플 ${version}`,
          notes: release.body,
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
    const statusText = isSafe ? '이번 달은 안전권이에요' : '이번 달 방어가 필요해요'

    return (
      <main className="screen homeScreen">
        <UpdateBanner update={update} onCheck={() => void checkForUpdate(true)} onDownload={openUpdate} />

        <section className="heroPanel">
          <div className="heroCopy">
            <span className="eyebrow">
              <ShieldCheck size={16} />
              {statusText}
            </span>
            <h1>오늘 사용 가능</h1>
            <strong className="safeAmount">{won(plan.safeDaily)}</strong>
            <p>고정비, 목표저축, 안전잔고를 빼고 오늘 써도 되는 금액입니다.</p>
          </div>
          <div className="balanceBadge">
            <span>현재 잔고</span>
            <strong>{won(data.profile.currentBalance)}</strong>
          </div>
        </section>

        <section className="metricGrid">
          <article className="metric">
            <span>월말 예상</span>
            <strong className={plan.monthEndBalance < data.profile.safetyBuffer ? 'dangerText' : ''}>
              {won(plan.monthEndBalance)}
            </strong>
            <small>안전잔고 {won(data.profile.safetyBuffer)}</small>
          </article>
          <article className="metric">
            <span>생활비 남음</span>
            <strong>{won(plan.remainingBudget)}</strong>
            <small>이번 달 사용 {won(plan.variableSpent)}</small>
          </article>
          <article className="metric">
            <span>목표저축 필요</span>
            <strong>{won(plan.goalMonthlyNeed)}</strong>
            <small>목표 {data.goals.length}개 기준</small>
          </article>
          <article className="metric">
            <span>위험 신호</span>
            <strong>{plan.firstRisk ? parseIso(plan.firstRisk.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '없음'}</strong>
            <small>90일 최저 {won(plan.lowestPoint.balance)}</small>
          </article>
        </section>

        <section className="sectionBlock">
          <div className="sectionHeader">
            <div>
              <span className="eyebrow muted">
                <BarChart3 size={15} />
                90일 현금흐름
              </span>
              <h2>앞으로 잔고가 어디까지 내려가는지</h2>
            </div>
            <span className="pill">{plan.daysLeft}일 남음</span>
          </div>
          <CashflowChart points={plan.points} safetyBuffer={data.profile.safetyBuffer} />
        </section>

        <section className="split">
          <article className="sectionBlock compact">
            <div className="sectionHeader">
              <h2>오늘 빠른 입력</h2>
              <button type="button" className="iconButton" onClick={() => setActiveTab('record')} aria-label="기록 화면 열기">
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="quickForm">
              <input
                value={transactionForm.title}
                placeholder="예: 커피"
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
                추가
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
          </article>

          <article className="sectionBlock compact">
            <div className="sectionHeader">
              <h2>코치 메모</h2>
              <Bell size={18} />
            </div>
            <ul className="coachList">
              <li>
                <Check size={16} />
                하루 {won(plan.safeDaily)} 안에서 쓰면 월말 안전잔고를 지킬 수 있어요.
              </li>
              <li>
                <Check size={16} />
                다음 고정비는 {plan.recurringExpenseLeft > 0 ? won(plan.recurringExpenseLeft) : '이번 달 없음'} 남아 있어요.
              </li>
              <li>
                <Check size={16} />
                큰 소비 전에는 계획 탭에서 바로 시뮬레이션해보세요.
              </li>
            </ul>
          </article>
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
              빠른 기록
            </span>
            <h2>쓰자마자 잔고와 계획에 반영</h2>
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
            <h2>이번 달 지출 분포</h2>
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
              <EmptyState icon={BarChart3} title="이번 달 지출 데이터가 비어 있어요" />
            )}
          </div>
        </article>
      </section>
    </main>
  )

  const renderPlan = () => (
    <main className="screen">
      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <AlertTriangle size={15} />
              큰 소비 시뮬레이션
            </span>
            <h2>이 돈을 쓰면 계획이 어떻게 바뀌는지</h2>
          </div>
        </div>
        <div className="scenarioBox">
          <Field label="예상 소비" value={scenarioAmount} type="number" suffix="원" onChange={setScenarioAmount} />
          <div className="scenarioResult">
            <span>소비 후 하루 사용 가능</span>
            <strong>{won(scenario.safeDaily)}</strong>
            <small>월말 예상 {won(scenario.monthEndBalance)}</small>
          </div>
        </div>
      </section>

      <section className="split">
        <article className="sectionBlock">
          <div className="sectionHeader">
            <div>
              <span className="eyebrow muted">
                <Repeat size={15} />
                반복 지출/수입
              </span>
              <h2>날짜가 있는 돈 흐름</h2>
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
            반복 항목 추가
          </button>

          <div className="list recurringList">
            {data.recurring.map((item) => (
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
            ))}
          </div>
        </article>

        <article className="sectionBlock">
          <div className="sectionHeader">
            <h2>다가오는 90일</h2>
            <span className="pill">최저 {won(plan.lowestPoint.balance)}</span>
          </div>
          <div className="forecastList">
            {plan.points
              .filter((_, index) => index % 7 === 0 || index === 89)
              .slice(0, 10)
              .map((point) => (
                <div className="forecastRow" key={point.date}>
                  <span>{parseIso(point.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                  <strong className={point.balance < data.profile.safetyBuffer ? 'dangerText' : ''}>
                    {won(point.balance)}
                  </strong>
                </div>
              ))}
          </div>
        </article>
      </section>
    </main>
  )

  const renderGoals = () => (
    <main className="screen">
      <section className="sectionBlock">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow muted">
              <Target size={15} />
              목표저축
            </span>
            <h2>목표를 월별 필요 금액으로 쪼개기</h2>
          </div>
        </div>
        <div className="formGrid">
          <Field label="목표 이름" value={goalForm.title} onChange={(value) => setGoalForm((current) => ({ ...current, title: value }))} />
          <Field label="목표 금액" value={goalForm.target} type="number" suffix="원" onChange={(value) => setGoalForm((current) => ({ ...current, target: value }))} />
          <Field label="현재 모은 돈" value={goalForm.saved} type="number" suffix="원" onChange={(value) => setGoalForm((current) => ({ ...current, saved: value }))} />
          <Field label="목표 날짜" value={goalForm.dueDate} type="date" onChange={(value) => setGoalForm((current) => ({ ...current, dueDate: value }))} />
        </div>
        <button type="button" className="primary full" onClick={addGoal}>
          <Plus size={18} />
          목표 추가
        </button>
      </section>

      <section className="goalsGrid">
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
                  <span>월 {won(monthlyNeed)} 필요</span>
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
          <section className="sectionBlock">
            <EmptyState icon={Target} title="아직 목표가 없어요" />
          </section>
        )}
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
              기본 돈 설정
            </span>
            <h2>계산의 기준값</h2>
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
            <h2>업데이트</h2>
            <span className="pill">v{APP_VERSION}</span>
          </div>
          <p className="softText">GitHub 최신 릴리즈를 확인하고 APK 다운로드 창을 엽니다.</p>
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
          <p className="softText">폰을 바꾸거나 테스트 중 초기화할 때 JSON으로 내보내고 다시 불러올 수 있어요.</p>
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
              샘플 초기화
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
    goals: renderGoals(),
    settings: renderSettings(),
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <BrandMark />
          </div>
          <div>
            <strong>머니플</strong>
            <span>오늘 쓸 돈 코치</span>
          </div>
        </div>

        <nav className="navList" aria-label="주요 메뉴">
          {tabItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.id}
                className={activeTab === item.id ? 'active' : ''}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebarSummary">
          <span>이번 달 생활비</span>
          <strong>{won(plan.remainingBudget)}</strong>
          <small>남은 예산</small>
        </div>
      </aside>

      <div className="contentPane">
        <header className="topBar">
          <div>
            <span className="todayLabel">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
            <strong>{tabItems.find((item) => item.id === activeTab)?.label}</strong>
          </div>
          <button type="button" className="updateButton" onClick={() => void checkForUpdate(true)}>
            <RefreshCw size={16} />
            <span>{update.status === 'checking' ? '확인 중' : '업데이트'}</span>
          </button>
        </header>

        {screens[activeTab]}
      </div>

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
