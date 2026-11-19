import React, { useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface CashflowChartProps {
  transactions: Transaction[];
  selectedMonth: string; // 'ALL' or 'YYYY-MM'
  hasFullAccess: boolean;
}

interface DataPoint {
  key: string;
  label: string;
  expense: number;
  income: number;
  isTrailing?: boolean;
}

function niceCeiling(maxVal: number): number {
  if (maxVal <= 0) return 100;
  const exp = Math.floor(Math.log10(maxVal));
  const pow = Math.pow(10, exp);
  const norm = maxVal / pow;
  const step = norm <= 1.2 ? 1.2 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 4 ? 4 : norm <= 5 ? 5 : norm <= 8 ? 8 : 10;
  return Math.ceil((step * pow) / 4) * 4;
}

function formatAxisValue(v: number): string {
  if (v === 0) return '0';
  if (v >= 10000) return `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}w`;
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(v));
}

export const CashflowChart: React.FC<CashflowChartProps> = ({
  transactions,
  selectedMonth,
  hasFullAccess,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const series = useMemo<DataPoint[]>(() => {
    if (!hasFullAccess || transactions.length === 0) return [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const curMonthStr = todayStr.slice(0, 7);

    if (selectedMonth && selectedMonth !== 'ALL') {
      const [yStr, mStr] = selectedMonth.split('-');
      const year = Number(yStr);
      const month = Number(mStr);
      if (!year || !month) return [];

      const daysInMonth = new Date(year, month, 0).getDate();
      const maxDay =
        selectedMonth === curMonthStr ? Math.min(daysInMonth, now.getDate()) : daysInMonth;

      const byDay = new Map<string, { expense: number; income: number }>();
      transactions.forEach((t) => {
        if (!t.date?.startsWith(selectedMonth)) return;
        const entry = byDay.get(t.date) || { expense: 0, income: 0 };
        if (t.amount >= 0) entry.income += t.amount;
        else entry.expense += Math.abs(t.amount);
        byDay.set(t.date, entry);
      });

      const points: DataPoint[] = [];
      for (let d = 1; d <= maxDay; d++) {
        const key = `${selectedMonth}-${String(d).padStart(2, '0')}`;
        const val = byDay.get(key) || { expense: 0, income: 0 };
        points.push({
          key,
          label: `${mStr}-${String(d).padStart(2, '0')}`,
          expense: val.expense,
          income: val.income,
          isTrailing: key === todayStr,
        });
      }
      return points;
    }

    // ALL months: aggregate by YYYY-MM ascending
    const byMonth = new Map<string, { expense: number; income: number }>();
    transactions.forEach((t) => {
      if (!t.date || t.date.length < 7) return;
      const m = t.date.slice(0, 7);
      const entry = byMonth.get(m) || { expense: 0, income: 0 };
      if (t.amount >= 0) entry.income += t.amount;
      else entry.expense += Math.abs(t.amount);
      byMonth.set(m, entry);
    });

    const keys = Array.from(byMonth.keys()).sort();
    return keys.map((m) => {
      const val = byMonth.get(m)!;
      return {
        key: m,
        label: m,
        expense: val.expense,
        income: val.income,
        isTrailing: m === curMonthStr,
      };
    });
  }, [transactions, selectedMonth, hasFullAccess]);

  const maxVal = useMemo(() => {
    let m = 0;
    series.forEach((p) => {
      if (p.expense > m) m = p.expense;
      if (p.income > m) m = p.income;
    });
    return niceCeiling(m);
  }, [series]);

  const yTicks = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0];

  const xPos = (i: number) => (series.length <= 1 ? 500 : (i / (series.length - 1)) * 1000);
  const yPos = (val: number) => 1000 - (maxVal > 0 ? (val / maxVal) * 1000 : 0);

  const hasTrailing = series.length >= 2 && series[series.length - 1].isTrailing;
  const solidEnd = hasTrailing ? series.length - 1 : series.length;

  const solidExpPoints = series
    .slice(0, solidEnd)
    .map((p, i) => `${xPos(i).toFixed(1)},${yPos(p.expense).toFixed(1)}`)
    .join(' ');
  const solidIncPoints = series
    .slice(0, solidEnd)
    .map((p, i) => `${xPos(i).toFixed(1)},${yPos(p.income).toFixed(1)}`)
    .join(' ');

  const tailExpPoints = hasTrailing
    ? `${xPos(series.length - 2).toFixed(1)},${yPos(series[series.length - 2].expense).toFixed(1)} ${xPos(
        series.length - 1
      ).toFixed(1)},${yPos(series[series.length - 1].expense).toFixed(1)}`
    : '';
  const tailIncPoints = hasTrailing
    ? `${xPos(series.length - 2).toFixed(1)},${yPos(series[series.length - 2].income).toFixed(1)} ${xPos(
        series.length - 1
      ).toFixed(1)},${yPos(series[series.length - 1].income).toFixed(1)}`
    : '';

  // Pick up to 7 evenly spaced X labels
  const xLabels = useMemo(() => {
    if (series.length === 0) return [];
    if (series.length <= 7) {
      return series.map((p, i) => ({
        idx: i,
        label: p.label,
        pct: series.length === 1 ? 50 : (i / (series.length - 1)) * 100,
      }));
    }
    const count = 6;
    const out: { idx: number; label: string; pct: number }[] = [];
    for (let k = 0; k <= count; k++) {
      const idx = Math.round((k / count) * (series.length - 1));
      out.push({
        idx,
        label: series[idx].label,
        pct: (idx / (series.length - 1)) * 100,
      });
    }
    return out;
  }, [series]);

  const hovered = hoverIdx !== null ? series[hoverIdx] : null;

  return (
    <div className="pt-chart">
      <div className="legend">
        {hovered ? (
          <span style={{ marginRight: 'auto', color: '#262626', fontFamily: 'var(--font-mono)' }}>
            <b>{hovered.key}</b> · 支出 {formatCurrency(-hovered.expense)} · 收入{' '}
            {formatCurrency(hovered.income, true)}
          </span>
        ) : null}
        <span>
          <i className="exp" />
          支出
        </span>
        <span>
          <i />
          收入
        </span>
        {hasTrailing && (
          <span>
            <i className="end" />
            进行中
          </span>
        )}
      </div>

      <div className="ys" aria-hidden="true">
        {yTicks.map((val, idx) => (
          <span key={idx} style={{ top: `${idx * 25}%` }}>
            {formatAxisValue(val)}
          </span>
        ))}
      </div>

      <div
        className="plot"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          if (series.length === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const idx = Math.round(ratio * (series.length - 1));
          setHoverIdx(idx);
        }}
      >
        <div className="gl" style={{ top: '0%' }} />
        <div className="gl" style={{ top: '25%' }} />
        <div className="gl" style={{ top: '50%' }} />
        <div className="gl" style={{ top: '75%' }} />

        {!hasFullAccess ? (
          <div className="none">数据已脱敏 · 按 "." 登录后台查看收支趋势</div>
        ) : series.length === 0 ? (
          <div className="none">当前范围暂无收支数据</div>
        ) : (
          <>
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              {tailIncPoints && <polyline className="inc end" points={tailIncPoints} />}
              {tailExpPoints && <polyline className="exp end" points={tailExpPoints} />}
              {solidIncPoints && <polyline className="inc" points={solidIncPoints} />}
              {solidExpPoints && <polyline className="exp" points={solidExpPoints} />}
              {hoverIdx !== null && (
                <line
                  x1={xPos(hoverIdx)}
                  x2={xPos(hoverIdx)}
                  y1={0}
                  y2={1000}
                  stroke="#999"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {hoverIdx !== null && hovered && (
              <>
                <span
                  style={{
                    position: 'absolute',
                    left: `${(xPos(hoverIdx) / 1000) * 100}%`,
                    top: `${(yPos(hovered.expense) / 1000) * 100}%`,
                    width: 6,
                    height: 6,
                    marginLeft: -3,
                    marginTop: -3,
                    background: '#ff6600',
                    border: '1px solid #262626',
                    pointerEvents: 'none',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: `${(xPos(hoverIdx) / 1000) * 100}%`,
                    top: `${(yPos(hovered.income) / 1000) * 100}%`,
                    width: 6,
                    height: 6,
                    marginLeft: -3,
                    marginTop: -3,
                    background: '#333399',
                    border: '1px solid #262626',
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}
          </>
        )}
      </div>

      <div className="xs" aria-hidden="true">
        {xLabels.map((item, i) => (
          <span
            key={item.idx}
            className={i === 0 ? 'first' : i === xLabels.length - 1 ? 'last' : ''}
            style={{ left: `${item.pct.toFixed(2)}%` }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};
