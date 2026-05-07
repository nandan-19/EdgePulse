'use client';
import { useEffect, useState, useRef } from 'react';
import { useStream } from '@/hooks/useStream';

interface Stats {
  raw:  { total: number; last_min: number; last_10s: number };
  proc: { total: number };
  anom: { total: number; last_min: number };
  patients: { patient_id: string; heart_rate: number; spo2: number; activity_level: string }[];
}

const C = {
  gen:   { s: '#2563eb', f: '#eff6ff', t: '#1e3a8a', g: 'rgba(37,99,235,0.2)'  },
  kafka: { s: '#d97706', f: '#fffbeb', t: '#78350f', g: 'rgba(217,119,6,0.2)'  },
  spark: { s: '#7c3aed', f: '#f5f3ff', t: '#4c1d95', g: 'rgba(124,58,237,0.2)'  },
  pg:    { s: '#059669', f: '#ecfdf5', t: '#064e3b', g: 'rgba(5,150,105,0.2)'  },
  dash:  { s: '#db2777', f: '#fdf2f8', t: '#831843', g: 'rgba(219,39,119,0.2)'  },
};

interface Particle { x: number; y: number; tx: number; ty: number; cp1x: number; cp1y: number; cp2x: number; cp2y: number; t: number; spd: number; col: string; }

export default function PipelineFlow() {
  const [stats, setStats] = useState<Stats | null>(null);
  const prevTotalRef  = useRef(0);
  const nodeFlashRef  = useRef<Record<string, number>>({});
  const particlesRef  = useRef<Particle[]>([]);
  const frameRef      = useRef(0);
  const canvasRef     = useRef<HTMLCanvasElement>(null);

  useStream({
    vitals: (d: unknown) => {
      const data = d as { stats: { total: number; last_min: number; last_10s: number } };
      setStats(prev => prev ? { ...prev, raw: data.stats } : null);
    },
  });

  useEffect(() => {
    const load = () => fetch('/api/pipeline').then(r => r.json()).then(setStats);
    load(); const id = setInterval(load, 5000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!stats) return;
    if (stats.raw.total > prevTotalRef.current) {
      nodeFlashRef.current['pg-raw'] = Date.now();
      prevTotalRef.current = stats.raw.total;
    }
  }, [stats?.raw?.total]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => { if(!canvasRef.current) return; canvasRef.current.width = canvasRef.current.offsetWidth; canvasRef.current.height = canvasRef.current.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    function bezierPoint(p: Particle, t: number) {
      const mt = 1 - t;
      return {
        x: mt*mt*mt*p.x + 3*mt*mt*t*p.cp1x + 3*mt*t*t*p.cp2x + t*t*t*p.tx,
        y: mt*mt*mt*p.y + 3*mt*mt*t*p.cp1y + 3*mt*t*t*p.cp2y + t*t*t*p.ty,
      };
    }

    function spawnParticle(x1:number,y1:number,x2:number,y2:number,col:string,spd=0.003) {
      const mx = (x1+x2)/2;
      particlesRef.current.push({ x:x1,y:y1,tx:x2,ty:y2,cp1x:mx,cp1y:y1,cp2x:mx,cp2y:y2, t:0, spd, col });
      if (particlesRef.current.length > 120) particlesRef.current.shift();
    }

    function node(x:number,y:number,w:number,h:number,type:keyof typeof C,label:string,sub='') {
      const c = C[type]; const flash = nodeFlashRef.current[type];
      const isFlashing = flash && Date.now()-flash < 600;
      ctx.save();
      ctx.shadowColor = isFlashing ? '#3b82f6' : c.g;
      ctx.shadowBlur  = isFlashing ? 12 : 4;
      ctx.strokeStyle = isFlashing ? '#3b82f6' : c.s; ctx.lineWidth = isFlashing ? 2 : 1.5;
      ctx.fillStyle = c.f;
      ctx.beginPath(); ctx.roundRect(x,y,w,h,8); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = c.t; ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.textAlign = 'center';
      ctx.fillText(label, x+w/2, y+h/2-(sub?6:0));
      if (sub) { ctx.fillStyle='#64748b'; ctx.font='9px monospace'; ctx.fillText(sub,x+w/2,y+h/2+9); }
    }

    function edge(x1:number,y1:number,x2:number,y2:number,col:string,t:number) {
      const mx = (x1+x2)/2;
      ctx.save(); ctx.strokeStyle=col+'66'; ctx.lineWidth=1.5; ctx.setLineDash([6,5]); ctx.lineDashOffset=-t*14;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.bezierCurveTo(mx,y1,mx,y2,x2,y2); ctx.stroke(); ctx.restore();
    }

    let spawnTimer = 0;
    function animate(ts: number) {
      const W = canvas!.width, H = canvas!.height;
      ctx.clearRect(0,0,W,H);
      const t = ts/1000;

      // Grid for light theme
      ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=0.5;
      for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

      const rate10s = stats?.raw?.last_10s ?? 0;
      const spd     = Math.max(0.004, Math.min(0.012, rate10s / 800));
      const spawnMs = Math.max(200, 2000 / Math.max(1, rate10s / 5));

      const GX=30, KX=230, SX=420, PX=610, DX=800;
      const py = (i:number) => 35 + i*72;
      const KCY = 280, KH=160;

      for(let i=0;i<8;i++) edge(GX+130,py(i)+16,KX,KCY+KH/2,C.gen.s,t*0.7+i*0.1);
      [[155,200],[155,280],[155,360]].forEach(([sy,ky],i)=>{ const sc=[C.spark.s,C.kafka.s,C.spark.s][i]; edge(KX+140,KCY+KH/2,SX,sy,sc,t*0.6+i*0.3); edge(SX+135,sy,PX,sy,C.pg.s,t*0.7+i*0.2); edge(PX+140,sy,DX,KCY+KH/2,C.dash.s,t*0.5+i*0.4); });

      if (ts - spawnTimer > spawnMs) {
        spawnTimer = ts;
        const i = Math.floor(Math.random()*8);
        spawnParticle(GX+130,py(i)+16, KX,KCY+KH/2, C.gen.s, spd);
        const lane = Math.floor(Math.random()*3);
        const laneY = [155,280,360][lane];
        spawnParticle(KX+140,KCY+KH/2, SX,laneY, C.spark.s, spd*1.1);
        spawnParticle(SX+135,laneY, PX,laneY, C.pg.s, spd*1.2);
        spawnParticle(PX+140,laneY, DX,KCY+KH/2, C.dash.s, spd*0.9);
      }

      particlesRef.current = particlesRef.current.filter(p => p.t <= 1);
      particlesRef.current.forEach(p => {
        p.t += p.spd;
        const {x,y} = bezierPoint(p, Math.min(p.t,1));
        const alpha = p.t < 0.1 ? p.t/0.1 : p.t > 0.9 ? (1-p.t)/0.1 : 1;
        ctx.save(); ctx.shadowColor=p.col; ctx.shadowBlur=6;
        ctx.fillStyle=p.col; ctx.globalAlpha=alpha;
        ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill(); ctx.restore();
      });

      const p = stats?.patients ?? [];
      for(let i=0;i<8;i++){
        const pt=p[i]; const lbl=pt?.patient_id??`P${1001+i}`;
        const sub=pt?`HR:${pt.heart_rate} O₂:${pt.spo2}%`:'—';
        const type = pt?.activity_level==='deteriorating' ? 'kafka' : 'gen';
        node(GX,py(i),130,32,'gen',lbl,sub);
      }

      const rate=stats?.raw?.last_10s??0;
      node(KX,KCY,140,KH,'kafka','⚡ KAFKA',`${rate*6|0}/min · 3 topics`);

      [['▶ Raw',`5s · ${(stats?.raw?.total??0).toLocaleString()} rows`],['▶ Anomaly',`5s · ${(stats?.anom?.total??0).toLocaleString()} flags`],['▶ Window',`30s · ${(stats?.proc?.total??0)} agg`]]
        .forEach(([l,s],i)=>node(SX,[155,280,360][i]-22,135,50,'spark',l,s));

      [['raw_telemetry',`${(stats?.raw?.total??0).toLocaleString()} rows`],['anomalies',`${(stats?.anom?.total??0).toLocaleString()} rows`],['processed',`${(stats?.proc?.total??0)} rows`]]
        .forEach(([l,s],i)=>{ const key=['pg-raw','pg-anom','pg-proc'][i] as keyof typeof C; node(PX,[155,280,360][i]-22,140,50,'pg',l,s); });

      node(DX,KCY,130,KH,'dash','🖥 DASHBOARD','localhost:3000\nSSE push · <1s');

      frameRef.current = requestAnimationFrame(animate);
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frameRef.current); ro.disconnect(); };
  }, [stats]);

  return (
    <div className="card p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-800">🔄 Live Pipeline Flow</h2>
        <span className="text-xs text-slate-500 font-mono font-medium bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
          particle speed ∝ {stats?.raw?.last_10s ?? 0} events/10s
        </span>
      </div>
      <canvas ref={canvasRef} className="w-full rounded-lg bg-white border border-slate-100 shadow-inner" style={{ height: 580, display: 'block' }} />
    </div>
  );
}
