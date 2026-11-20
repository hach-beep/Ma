import React from 'react';
import { CongestionLevel, CONGESTION_META } from '../types';

interface QueueRingGaugeProps {
  queueCount: number;
  waitMinutes: number;
  congestion: CongestionLevel;
  activePumps: number;
  size?: 'md' | 'lg';
}

export const QueueRingGauge: React.FC<QueueRingGaugeProps> = ({
  queueCount,
  waitMinutes,
  congestion,
  activePumps,
  size = 'md',
}) => {
  const radius = size === 'lg' ? 68 : 54;
  const strokeWidth = size === 'lg' ? 11 : 9;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  // Map queue count 0..25 to ring progress (minimum 8% visible when open)
  const ratio = Math.min(1, Math.max(0.06, queueCount / 25));
  const strokeDashoffset = circumference - ratio * circumference;

  const meta = CONGESTION_META[congestion];
  const dimension = radius * 2;

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="relative flex items-center justify-center"
        style={{ width: dimension, height: dimension }}
      >
        <svg
          width={dimension}
          height={dimension}
          className="-rotate-90 transform"
          aria-label={`حالة الطابور: ${queueCount} سيارة، الانتظار ${waitMinutes} دقيقة`}
        >
          <circle
            stroke="#E2E8F0"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={meta.dotColor}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{
              strokeDashoffset,
              transition: 'stroke-dashoffset 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <span
            className={`font-mono-num font-bold text-[#0F172A] ${
              size === 'lg' ? 'text-3xl' : 'text-2xl'
            }`}
          >
            {queueCount}
          </span>
          <span className="text-[11px] font-medium text-slate-500">سيارة في الطابور</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className={`font-semibold ${meta.badgeTextClass}`}>{meta.labelAr}</span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span className="font-mono-num font-semibold text-slate-900">
          ~ {waitMinutes} دقيقة
        </span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span className="tabular-nums">{activePumps} مضخات عاملة</span>
      </div>
    </div>
  );
};
