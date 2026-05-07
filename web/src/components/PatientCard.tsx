'use client';
import { Heart, Droplets, Thermometer, Wind, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';
import { useRef, useEffect, useState } from 'react';

export interface VitalData {
  patient_id: string;
  heart_rate: number;
  spo2: number;
  temperature: number;
  respiratory_rate: number;
  activity_level: string;
}

interface Props extends VitalData {
  selected?: boolean;
  onClick?: () => void;
}

const hrColor   = (v: number) => v > 120 ? 'text-red-400' : v > 100 ? 'text-amber-400' : 'text-emerald-400';
const spo2Color = (v: number) => v < 90  ? 'text-red-400' : v < 95  ? 'text-amber-400' : 'text-cyan-400';
const tempColor = (v: number) => v > 39.5 ? 'text-red-400' : v > 38  ? 'text-amber-400' : 'text-yellow-300';
const stateColors: Record<string, string> = {
  resting:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  active:       'bg-blue-500/10 text-blue-400 border-blue-500/30',
  deteriorating:'bg-red-500/10 text-red-400 border-red-500/30',
  recovering:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
};
const isCritical = (hr: number, spo2: number) => (hr > 130 && spo2 < 90) || spo2 < 88;

// Delta direction — for HR and resp, UP is bad; for SpO2, DOWN is bad
function Delta({ curr, prev, invert = false }: { curr: number; prev: number | null; invert?: boolean }) {
  if (prev === null) return null;
  const diff = +(curr - prev).toFixed(1);
  if (Math.abs(diff) < 0.5) return <Minus className="w-3 h-3 text-slate-600 inline ml-1" />;
  const isGood = invert ? diff > 0 : diff < 0;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-[10px] font-mono ml-1', isGood ? 'text-emerald-400' : 'text-red-400')}>
      {diff > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {diff > 0 ? '+' : ''}{diff}
    </span>
  );
}

export default function PatientCard({ patient_id, heart_rate, spo2, temperature, respiratory_rate, activity_level, selected, onClick }: Props) {
  const critical = isCritical(heart_rate, spo2);
  const prevRef = useRef<VitalData | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current) {
      // Values changed — trigger flash ring
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 800);
      return () => clearTimeout(t);
    }
    prevRef.current = { patient_id, heart_rate, spo2, temperature, respiratory_rate, activity_level };
  }, [heart_rate, spo2, temperature, respiratory_rate]);

  const prev = prevRef.current;

  useEffect(() => {
    prevRef.current = { patient_id, heart_rate, spo2, temperature, respiratory_rate, activity_level };
  });

  return (
    <div onClick={onClick} className={clsx(
      'card p-4 cursor-pointer transition-all duration-200 hover:border-blue-500/40 relative overflow-hidden',
      selected && 'border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.25)]',
      critical && 'border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      flash && !critical && !selected && 'border-emerald-500/60',
    )}>
      {/* Flash ring animation */}
      {flash && (
        <span className="absolute inset-0 rounded-xl border-2 border-emerald-400/60 animate-ping" style={{ animationDuration: '0.7s', animationIterationCount: 1 }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-sm font-bold text-slate-200">{patient_id}</span>
        <div className="flex items-center gap-1.5">
          {critical && <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
          <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-semibold capitalize', stateColors[activity_level] ?? stateColors.resting)}>
            {activity_level}
          </span>
        </div>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-2 gap-2">
        <Vital icon={<Heart className="w-3 h-3" />} label="HR"
          value={heart_rate} unit="bpm" color={hrColor(heart_rate)}
          delta={<Delta curr={heart_rate} prev={prev?.heart_rate ?? null} />} />
        <Vital icon={<Droplets className="w-3 h-3" />} label="SpO₂"
          value={spo2} unit="%" color={spo2Color(spo2)}
          delta={<Delta curr={spo2} prev={prev?.spo2 ?? null} invert />} />
        <Vital icon={<Thermometer className="w-3 h-3" />} label="Temp"
          value={temperature} unit="°C" color={tempColor(temperature)}
          delta={<Delta curr={temperature} prev={prev?.temperature ?? null} />} />
        <Vital icon={<Wind className="w-3 h-3" />} label="Resp"
          value={respiratory_rate} unit="bpm" color="text-purple-400"
          delta={<Delta curr={respiratory_rate} prev={prev?.respiratory_rate ?? null} />} />
      </div>
    </div>
  );
}

function Vital({ icon, label, value, unit, color, delta }: {
  icon: React.ReactNode; label: string; value: number; unit: string; color: string; delta?: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-2">
      <div className="flex items-center gap-1 text-slate-500 text-[10px] mb-1">{icon}{label}</div>
      <div className="flex items-baseline">
        <span className={clsx('text-lg font-bold tabular-nums', color)}>{value}</span>
        <span className="text-slate-500 text-[10px] ml-0.5">{unit}</span>
        {delta}
      </div>
    </div>
  );
}
