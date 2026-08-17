export function technicalReliability(dp, analytics = null) {
  if (!dp?.pack) return { score: 0, label: 'Indisponível', className: 'low', components: {} };
  const p = dp.pack;
  const v = analytics?.vectors || {};
  const dea = analytics?.dea || {};
  const n = Number(p.nAnalysisSamples || p.nPatients || 0);
  const events = Number(v.nEvents || 0);

  let sample = n >= 200 ? 25 : n >= 100 ? 22 : n >= 50 ? 18 : n >= 20 ? 12 : n > 0 ? 6 : 0;
  let molecular = (p.capabilities?.expression ? 13 : 0) + (p.capabilities?.mutation ? 12 : 0);
  let outcome = 0;
  if (p.capabilities?.survival && Number(v.time?.length || 0) >= 20) outcome += 15;
  outcome += events >= 20 ? 10 : events >= 10 ? 7 : events >= 5 ? 4 : 0;
  let integrity = p.capabilities?.clinical ? 10 : 0;
  const onePerPatient = p.nAnalysisSamples > 0 && p.nPatients > 0 && p.nAnalysisSamples <= p.nPatients * 1.05;
  if (onePerPatient) integrity += 10;
  if (Number(dea.n0 || 0) >= 10 && Number(dea.n1 || 0) >= 10) integrity += 5;

  const score = Math.max(0, Math.min(100, Math.round(sample + molecular + outcome + integrity)));
  const label = score >= 80 ? 'Alta' : score >= 60 ? 'Moderada' : 'Baixa';
  const className = score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
  return {
    score,
    label,
    className,
    components: { sample, molecular, outcome, integrity },
    note: 'Índice técnico de completude/adequação do conjunto de dados; não representa confiança diagnóstica, acurácia clínica ou probabilidade prognóstica.'
  };
}

export function deaFileQuality(summary) {
  const clean = summary?.clean || [];
  const withP = clean.filter(x => Number.isFinite(x.logFC) && Number.isFinite(x.adjP) && x.adjP >= 0 && x.adjP <= 1);
  if (!clean.length) return { score: 0, label: 'Baixa', invalidScale: true, message: 'Nenhuma linha válida com gene e efeito numérico.' };
  const coverage = withP.length / clean.length;
  const abs = withP.map(x => Math.abs(x.logFC)).sort((a,b)=>a-b);
  const q = p => abs.length ? abs[Math.min(abs.length - 1, Math.floor((abs.length - 1) * p))] : NaN;
  const p99 = q(.99), maxAbs = abs.length ? abs[abs.length - 1] : NaN;
  const invalidScale = Number.isFinite(maxAbs) && (maxAbs > 50 || p99 > 25);
  let score = Math.round(coverage * 70 + (invalidScale ? 0 : 30));
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    label: score >= 85 ? 'Alta' : score >= 65 ? 'Moderada' : 'Baixa',
    invalidScale,
    coverage,
    p99,
    maxAbs,
    message: invalidScale
      ? 'A coluna identificada como log2FC possui amplitudes incompatíveis com uma escala log2 típica (ex.: valores extremos > 50). O GENESIS não tratará esse arquivo como DEA log2 válida. Recalcule a DEA a partir da matriz de expressão transformada ou importe um resultado corrigido.'
      : 'Estrutura numérica compatível com visualização de DEA; a qualidade estatística ainda depende do método que gerou o arquivo.'
  };
}
