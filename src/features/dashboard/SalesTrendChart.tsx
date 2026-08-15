import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Segmented } from '@/components/ui'
import { formatDateShort, formatRupiah, formatRupiahCompact } from '@/lib/format'
import type { DailyPoint } from '@/lib/profit'

/**
 * Dua deret pada satu sumbu. Keduanya rupiah, jadi tidak ada sumbu ganda:
 * membandingkan dua skala berbeda dalam satu bidang membuat grafik berbohong.
 *
 * Identitas deret tidak pernah hanya lewat warna. Laba bersih memakai garis
 * putus putus, keduanya punya legenda, dan seluruh angkanya bisa dibaca lewat
 * tampilan tabel di bawah tombol yang sama.
 */
const SERIES = [
  { key: 'revenue', label: 'Omzet', color: 'var(--chart-1)', dash: undefined },
  { key: 'netProfit', label: 'Laba bersih', color: 'var(--chart-2)', dash: '6 4' },
] as const

function labelOf(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return formatDateShort(new Date(year, month - 1, day))
}

interface TooltipPayloadEntry {
  dataKey?: string | number
  value?: number
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}) {
  if (!active || !payload?.length || !label) return null

  return (
    <div className="rounded-control border border-border bg-surface px-3 py-2 shadow-e2">
      <p className="text-xs font-medium text-ink">{labelOf(label)}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {SERIES.map((series) => {
          const entry = payload.find((item) => item.dataKey === series.key)
          return (
            <li key={series.key} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              <span className="text-ink-muted">{series.label}</span>
              <span className="tabular ml-auto font-medium text-ink">
                {formatRupiah(entry?.value ?? 0)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function SalesTrendChart({ data }: { data: DailyPoint[] }) {
  const [view, setView] = useState<'grafik' | 'tabel'>('grafik')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Legenda selalu ada untuk dua deret atau lebih. */}
        <ul className="flex flex-wrap items-center gap-4">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-2 text-xs text-ink-muted">
              <span
                aria-hidden
                className="h-0.5 w-5 rounded-full"
                style={{
                  backgroundColor: series.color,
                  backgroundImage: series.dash
                    ? `repeating-linear-gradient(90deg, ${series.color} 0 6px, transparent 6px 10px)`
                    : undefined,
                }}
              />
              {series.label}
            </li>
          ))}
        </ul>

        <Segmented
          aria-label="Tampilan data penjualan"
          value={view}
          onChange={setView}
          options={[
            { value: 'grafik', label: 'Grafik' },
            { value: 'tabel', label: 'Tabel' },
          ]}
        />
      </div>

      {view === 'grafik' ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--chart-grid)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="date"
                tickFormatter={labelOf}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                tick={{ fill: 'var(--ink-subtle)', fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(value: number) => formatRupiahCompact(value)}
                tickLine={false}
                axisLine={false}
                width={72}
                tick={{ fill: 'var(--ink-subtle)', fontSize: 11 }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
              />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2}
                  strokeDasharray={series.dash}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs text-ink-muted">
                <th className="py-2 pr-4 font-medium">Tanggal</th>
                <th className="py-2 pr-4 text-right font-medium">Omzet</th>
                <th className="py-2 text-right font-medium">Laba bersih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((point) => (
                <tr key={point.date}>
                  <td className="py-2 pr-4 text-ink-muted">{labelOf(point.date)}</td>
                  <td className="tabular py-2 pr-4 text-right text-ink">
                    {formatRupiah(point.revenue)}
                  </td>
                  <td className="tabular py-2 text-right text-ink">
                    {formatRupiah(point.netProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
