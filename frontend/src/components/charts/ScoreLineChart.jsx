import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { formatShortDayMonth } from '../../utils/date'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-md)', fontSize: 13, maxWidth: 200 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 2, fontSize: 11 }}>{d.date}</p>
      <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--text)', wordBreak: 'break-word' }}>{d.fullName}</p>
      <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 18 }}>
        {payload[0].value}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}> / 5</span>
      </p>
    </div>
  )
}

const MIN_PX_PER_POINT = 40

export default function ScoreLineChart({ data }) {
  const { i18n } = useTranslation()
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No score data yet
      </div>
    )
  }

  const chartData = data.map(d => ({
    label: formatShortDayMonth(d.date, i18n.language),
    score: d.score,
    fullName: d.lesson,
    date: d.date,
  }))

  const minWidth = Math.max(chartData.length * MIN_PX_PER_POINT, 300)
  const dotR = chartData.length > 30 ? 2.5 : 4
  const tickInterval = chartData.length > 20 ? Math.floor(chartData.length / 10) : 0

  return (
    <div ref={scrollRef} style={{ overflowX: 'auto', width: '100%' }}>
      <div style={{ minWidth, width: '100%' }}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis
              domain={[0, 5]} ticks={[0,1,2,3,4,5]}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={3} stroke="var(--warning)" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Line
              type="monotone" dataKey="score"
              stroke="var(--accent)" strokeWidth={2.5}
              dot={{ fill: 'var(--accent)', strokeWidth: 0, r: dotR }}
              activeDot={{ r: dotR + 2, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
