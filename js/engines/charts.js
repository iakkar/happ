/**
 * Huawei Health + Garmin Connect Dark Mode Canvas Chart Engine
 * Supports W (7 Days), M (30 Days), Y (12 Months) time ranges,
 * EWMA trend overlays, dual-metric overlays, and calorie/TDEE bars.
 */

export function buildTimeSeries(dailyRecords, allMeals, endDateStr, rangeMode = 'W') {
  const endObj = new Date(endDateStr + 'T12:00:00');
  const recordMap = new Map(dailyRecords.map(r => [r.date, r]));
  const mealKcalMap = new Map();
  const mealMacrosMap = new Map();

  for (const m of allMeals) {
    mealKcalMap.set(m.date, (mealKcalMap.get(m.date) || 0) + (Number(m.calories) || 0));
    const cur = mealMacrosMap.get(m.date) || { p: 0, c: 0, f: 0 };
    cur.p += Number(m.protein) || 0;
    cur.c += Number(m.carbs) || 0;
    cur.f += Number(m.fat) || 0;
    mealMacrosMap.set(m.date, cur);
  }

  if (rangeMode === 'Y') {
    // 12 Monthly Buckets ending in current month
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(endObj.getFullYear(), endObj.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });

      const monthRecords = dailyRecords.filter(r => r.date.startsWith(ym));
      const monthMealsDates = [...mealKcalMap.keys()].filter(k => k.startsWith(ym));

      const avgField = (key) => {
        const vals = monthRecords.map(r => r[key]).filter(v => v != null && v !== '' && !isNaN(v)).map(Number);
        if (!vals.length) return null;
        return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
      };

      const minMaxField = (key) => {
        const vals = monthRecords.map(r => r[key]).filter(v => v != null && v !== '' && !isNaN(v)).map(Number);
        if (!vals.length) return null;
        return { min: Math.min(...vals), max: Math.max(...vals) };
      };

      const kcalVals = monthMealsDates.map(k => mealKcalMap.get(k)).filter(v => v > 0);
      const avgCalories = kcalVals.length
        ? Math.round(kcalVals.reduce((a, b) => a + b, 0) / kcalVals.length)
        : null;

      buckets.push({
        date: ym,
        label,
        weight: avgField('weight'),
        weightRange: minMaxField('weight'),
        bmi: avgField('bmi'),
        bodyFat: avgField('bodyFat'),
        skeletalMuscle: avgField('skeletalMuscle'),
        visceralFat: avgField('visceralFat'),
        bmr: avgField('bmr'),
        bodyWater: avgField('bodyWater'),
        boneMineral: avgField('boneMineral'),
        proteinPct: avgField('proteinPct'),
        muscleMass: avgField('muscleMass'),
        sleepHours: avgField('sleepHours'),
        sleepQuality: avgField('sleepQuality'),
        energy: avgField('energy'),
        soreness: avgField('soreness'),
        steps: avgField('steps'),
        cups: avgField('cups'),
        calories: avgCalories
      });
    }
    return buckets;
  }

  const daysCount = rangeMode === 'M' ? 30 : 7;
  const points = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(endObj);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const rec = recordMap.get(dateStr) || {};
    const label = rangeMode === 'W'
      ? d.toLocaleDateString('en-US', { weekday: 'short' })
      : `${d.getMonth() + 1}/${d.getDate()}`;

    points.push({
      date: dateStr,
      label,
      weight: rec.weight != null ? Number(rec.weight) : null,
      bmi: rec.bmi != null ? Number(rec.bmi) : null,
      bodyFat: rec.bodyFat != null ? Number(rec.bodyFat) : null,
      skeletalMuscle: rec.skeletalMuscle != null ? Number(rec.skeletalMuscle) : null,
      visceralFat: rec.visceralFat != null ? Number(rec.visceralFat) : null,
      bmr: rec.bmr != null ? Number(rec.bmr) : null,
      bodyWater: rec.bodyWater != null ? Number(rec.bodyWater) : null,
      boneMineral: rec.boneMineral != null ? Number(rec.boneMineral) : null,
      proteinPct: rec.proteinPct != null ? Number(rec.proteinPct) : null,
      muscleMass: rec.muscleMass != null ? Number(rec.muscleMass) : null,
      sleepHours: rec.sleepHours != null ? Number(rec.sleepHours) : null,
      sleepQuality: rec.sleepQuality != null ? Number(rec.sleepQuality) : null,
      energy: rec.energy != null ? Number(rec.energy) : null,
      soreness: rec.soreness != null ? Number(rec.soreness) : null,
      steps: rec.steps != null ? Number(rec.steps) : null,
      cups: rec.cups != null ? Number(rec.cups) : null,
      calories: mealKcalMap.get(dateStr) || null,
      macros: mealMacrosMap.get(dateStr) || { p: 0, c: 0, f: 0 }
    });
  }

  return points;
}

/**
 * Computes summary stats { latest, avg, min, max, delta } for a metric series
 */
export function computeSeriesStats(series, key, decimals = 1) {
  const valid = series.map(p => p[key]).filter(v => v != null && !isNaN(v));
  if (!valid.length) {
    return { latest: null, avg: null, min: null, max: null, delta: null, count: 0 };
  }
  const factor = Math.pow(10, decimals);
  const round = (n) => Math.round(n * factor) / factor;

  const first = valid[0];
  const latest = valid[valid.length - 1];
  const avg = round(valid.reduce((a, b) => a + b, 0) / valid.length);
  const min = round(Math.min(...valid));
  const max = round(Math.max(...valid));
  const delta = round(latest - first);

  return { latest: round(latest), avg, min, max, delta, count: valid.length };
}

/**
 * Renders a Garmin/Huawei Dark Mode Line + Area + EWMA Trend / Secondary Metric Chart onto a <canvas>
 */
export function renderMetricChart(canvas, series, options = {}) {
  if (!canvas) return;
  const {
    primaryKey = 'weight',
    primaryColor = '#00e5ff',
    secondaryKey = null,
    secondaryColor = '#f59e0b',
    showTrendLine = true,
    decimals = 1
  } = options;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 340;
  const height = rect.height || 210;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const padLeft = 42;
  const padRight = secondaryKey ? 40 : 16;
  const padTop = 22;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const primaryVals = series.map(p => p[primaryKey]).filter(v => v != null && !isNaN(v));
  if (primaryVals.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '500 13px "DM Sans", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data logged for this period yet', width / 2, height / 2);
    return;
  }

  let minVal = Math.min(...primaryVals);
  let maxVal = Math.max(...primaryVals);
  if (minVal === maxVal) {
    minVal -= 2;
    maxVal += 2;
  } else {
    const spread = maxVal - minVal;
    minVal -= spread * 0.15;
    maxVal += spread * 0.15;
  }

  // Horizontal Grid Lines (Huawei Health style subtle dashed lines)
  const gridSteps = 4;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = '500 10px "DM Sans", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridSteps; i++) {
    const ratio = i / gridSteps;
    const y = padTop + plotH - ratio * plotH;
    const val = minVal + ratio * (maxVal - minVal);

    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();

    ctx.fillText(val.toFixed(decimals), padLeft - 6, y + 3);
  }
  ctx.setLineDash([]);

  const getX = (idx) => {
    if (series.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (series.length - 1)) * plotW;
  };
  const getY = (val, min = minVal, max = maxVal) => {
    return padTop + plotH - ((val - min) / (max - min)) * plotH;
  };

  // X-Axis Labels
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  const labelStep = series.length > 14 ? Math.ceil(series.length / 6) : series.length > 7 ? 2 : 1;
  series.forEach((pt, idx) => {
    if (idx % labelStep === 0 || idx === series.length - 1) {
      ctx.fillText(pt.label, getX(idx), height - 8);
    }
  });

  // Collect coordinates for Primary Series
  const coords = [];
  series.forEach((pt, idx) => {
    const v = pt[primaryKey];
    if (v != null && !isNaN(v)) {
      coords.push({ x: getX(idx), y: getY(v), val: v, idx, range: pt.weightRange });
    }
  });

  // Optional Garmin-style Yearly Min/Max Range Candles
  if (primaryKey === 'weight') {
    series.forEach((pt, idx) => {
      if (pt.weightRange && pt.weightRange.min !== pt.weightRange.max) {
        const x = getX(idx);
        const yMin = getY(pt.weightRange.min);
        const yMax = getY(pt.weightRange.max);
        ctx.strokeStyle = primaryColor + '44';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, yMax);
        ctx.lineTo(x, yMin);
        ctx.stroke();
      }
    });
  }

  // Gradient Area Fill under Primary Line
  if (coords.length >= 2) {
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, primaryColor + '42');
    grad.addColorStop(1, primaryColor + '02');

    ctx.beginPath();
    ctx.moveTo(coords[0].x, padTop + plotH);
    coords.forEach(c => ctx.lineTo(c.x, c.y));
    ctx.lineTo(coords[coords.length - 1].x, padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Primary Line
  if (coords.length >= 2) {
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    coords.forEach((c, i) => {
      if (i === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();
  }

  // EWMA Smooth Trend Overlay (Dashed glowing curve)
  if (showTrendLine && coords.length >= 3) {
    let ewma = coords[0].val;
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff99';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    coords.forEach((c, i) => {
      ewma = 0.28 * c.val + 0.72 * ewma;
      const ty = getY(ewma);
      if (i === 0) ctx.moveTo(c.x, ty);
      else ctx.lineTo(c.x, ty);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Primary Data Dots
  coords.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, series.length > 15 ? 3 : 4.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0f17';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = primaryColor;
    ctx.stroke();

    // Highlight latest value label
    if (i === coords.length - 1) {
      ctx.fillStyle = primaryColor;
      ctx.font = '600 11px "DM Sans", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.val.toFixed(decimals), c.x, Math.max(14, c.y - 9));
    }
  });

  // Secondary Overlay Metric (Right Axis)
  if (secondaryKey) {
    const secVals = series.map(p => p[secondaryKey]).filter(v => v != null && !isNaN(v));
    if (secVals.length > 0) {
      let sMin = Math.min(...secVals);
      let sMax = Math.max(...secVals);
      if (sMin === sMax) {
        sMin -= 2;
        sMax += 2;
      } else {
        const sp = sMax - sMin;
        sMin -= sp * 0.15;
        sMax += sp * 0.15;
      }

      const secCoords = [];
      series.forEach((pt, idx) => {
        const v = pt[secondaryKey];
        if (v != null && !isNaN(v)) {
          secCoords.push({ x: getX(idx), y: getY(v, sMin, sMax), val: v });
        }
      });

      if (secCoords.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 2;
        secCoords.forEach((c, i) => {
          if (i === 0) ctx.moveTo(c.x, c.y);
          else ctx.lineTo(c.x, c.y);
        });
        ctx.stroke();
      }

      secCoords.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = secondaryColor;
        ctx.fill();
      });

      // Right axis labels
      ctx.fillStyle = secondaryColor;
      ctx.font = '500 10px "DM Sans", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sMax.toFixed(1), width - padRight + 5, padTop + 8);
      ctx.fillText(sMin.toFixed(1), width - padRight + 5, padTop + plotH);
    }
  }
}

/**
 * Renders Calorie Intake Bars vs. Adaptive TDEE Horizontal Target Line
 */
export function renderCalorieTdeeChart(canvas, series, tdeeValue = 2400, targetCalories = 2000) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 340;
  const height = rect.height || 190;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const padLeft = 42;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const vals = series.map(s => s.calories || 0);
  const maxVal = Math.max(3200, tdeeValue * 1.2, ...vals);

  const getY = (v) => padTop + plotH - (v / maxVal) * plotH;

  // Grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.fillStyle = '#64748b';
  ctx.font = '500 10px "DM Sans", "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'right';
  [1000, 2000, 3000].forEach(lvl => {
    if (lvl <= maxVal) {
      const y = getY(lvl);
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText(`${lvl}`, padLeft - 6, y + 3);
    }
  });
  ctx.setLineDash([]);

  // Bars
  const slotW = plotW / Math.max(1, series.length);
  const barW = Math.min(24, Math.max(4, slotW * 0.6));

  series.forEach((pt, idx) => {
    const xCenter = padLeft + idx * slotW + slotW / 2;
    const kcal = pt.calories || 0;
    if (kcal > 0) {
      const y = getY(kcal);
      const h = padTop + plotH - y;
      ctx.fillStyle = kcal > tdeeValue ? '#f59e0b' : '#10b981';
      ctx.beginPath();
      ctx.roundRect(xCenter - barW / 2, y, barW, h, [4, 4, 0, 0]);
      ctx.fill();
    }

    const step = series.length > 14 ? 5 : series.length > 7 ? 2 : 1;
    if (idx % step === 0 || idx === series.length - 1) {
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(pt.label, xCenter, height - 8);
    }
  });

  // TDEE Line
  const yTdee = getY(tdeeValue);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(padLeft, yTdee);
  ctx.lineTo(width - padRight, yTdee);
  ctx.stroke();

  // Target Line
  const yTarget = getY(targetCalories);
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(padLeft, yTarget);
  ctx.lineTo(width - padRight, yTarget);
  ctx.stroke();
  ctx.setLineDash([]);
}
