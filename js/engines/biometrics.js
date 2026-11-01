/**
 * Smart Scale Biometrics, EWMA Trend Weight & Adaptive TDEE Engine
 */

export const METRIC_DEFINITIONS = [
  {
    key: 'weight',
    label: 'Weight',
    shortLabel: 'Weight',
    unit: 'kg',
    decimals: 1,
    color: '#00e5ff',
    autoCalculated: false,
    description: 'Morning scale weight. Tracked alongside EWMA smoothed trend weight.'
  },
  {
    key: 'bmi',
    label: 'BMI',
    shortLabel: 'BMI',
    unit: '',
    decimals: 1,
    color: '#38bdf8',
    autoCalculated: true,
    ranges: [
      { label: 'Low', max: 18.4, color: '#38bdf8' },
      { label: 'Normal', max: 24.9, color: '#10b981' },
      { label: 'High', max: 29.9, color: '#f59e0b' },
      { label: 'Obese', max: 50, color: '#ef4444' }
    ],
    description: 'Body Mass Index — automatically calculated from your Weight and Height.'
  },
  {
    key: 'bodyFat',
    label: 'Body Fat',
    shortLabel: 'Body Fat',
    unit: '%',
    decimals: 1,
    color: '#f59e0b',
    autoCalculated: false,
    ranges: [
      { label: 'Athletic', max: 13.9, color: '#00e5ff' },
      { label: 'Normal', max: 20.9, color: '#10b981' },
      { label: 'Elevated', max: 25.9, color: '#f59e0b' },
      { label: 'High', max: 50, color: '#ef4444' }
    ],
    description: 'Percentage of total body mass composed of fat tissue.'
  },
  {
    key: 'skeletalMuscle',
    label: 'Skeletal Muscle',
    shortLabel: 'Skel. Muscle',
    unit: 'kg',
    decimals: 1,
    color: '#10b981',
    autoCalculated: false,
    ranges: [
      { label: 'Low', max: 26.9, color: '#f59e0b' },
      { label: 'Normal', max: 39.9, color: '#10b981' },
      { label: 'High', max: 60, color: '#00e5ff' }
    ],
    description: 'Skeletal muscle mass in kilograms responsible for strength and locomotion.'
  },
  {
    key: 'visceralFat',
    label: 'Visceral Fat',
    shortLabel: 'Visceral Fat',
    unit: 'idx',
    decimals: 1,
    color: '#f97316',
    autoCalculated: true,
    adjustable: true,
    ranges: [
      { label: 'Normal', max: 9.5, color: '#10b981' },
      { label: 'Elevated', max: 14.5, color: '#f59e0b' },
      { label: 'High', max: 30, color: '#ef4444' }
    ],
    description: 'Auto-calculated visceral fat rating (1–30 scale), also manually adjustable to match your smart scale.'
  },
  {
    key: 'bmr',
    label: 'BMR',
    shortLabel: 'BMR',
    unit: 'kcal',
    decimals: 0,
    color: '#a855f7',
    autoCalculated: true,
    adjustable: true,
    ranges: [
      { label: 'Low', max: 1399, color: '#f59e0b' },
      { label: 'Normal', max: 2250, color: '#10b981' },
      { label: 'High', max: 4000, color: '#00e5ff' }
    ],
    description: 'Basal Metabolic Rate — auto-calculated via Katch-McArdle / Mifflin-St Jeor, or manually overridden.'
  },
  {
    key: 'bodyWater',
    label: 'Body Water',
    shortLabel: 'Body Water',
    unit: '%',
    decimals: 1,
    color: '#06b6d4',
    autoCalculated: false,
    ranges: [
      { label: 'Low', max: 49.9, color: '#f59e0b' },
      { label: 'Normal', max: 65.0, color: '#10b981' },
      { label: 'High', max: 80.0, color: '#00e5ff' }
    ],
    description: 'Total body water percentage.'
  },
  {
    key: 'boneMineral',
    label: 'Bone Mineral Content',
    shortLabel: 'Bone Mineral',
    unit: 'kg',
    decimals: 2,
    color: '#cbd5e1',
    autoCalculated: false,
    ranges: [
      { label: 'Low', max: 1.89, color: '#f59e0b' },
      { label: 'Normal', max: 3.40, color: '#10b981' },
      { label: 'High', max: 5.00, color: '#00e5ff' }
    ],
    description: 'Bone mineral content (BMC) in kilograms.'
  },
  {
    key: 'proteinPct',
    label: 'Protein %',
    shortLabel: 'Protein %',
    unit: '%',
    decimals: 1,
    color: '#ec4899',
    autoCalculated: false,
    ranges: [
      { label: 'Low', max: 15.9, color: '#f59e0b' },
      { label: 'Normal', max: 20.0, color: '#10b981' },
      { label: 'High', max: 28.0, color: '#00e5ff' }
    ],
    description: 'Body protein percentage indicating cellular nutrition and muscle tone.'
  },
  {
    key: 'muscleMass',
    label: 'Muscle Mass',
    shortLabel: 'Muscle Mass',
    unit: 'kg',
    decimals: 1,
    color: '#22c55e',
    autoCalculated: false,
    ranges: [
      { label: 'Low', max: 44.9, color: '#f59e0b' },
      { label: 'Normal', max: 70.0, color: '#10b981' },
      { label: 'High', max: 100.0, color: '#00e5ff' }
    ],
    description: 'Total muscle mass in kilograms (skeletal + smooth + cardiac).'
  }
];

/**
 * Calculates BMI from weight (kg) and height (cm).
 */
export function calcBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const hM = heightCm / 100;
  return Math.round((weightKg / (hM * hM)) * 10) / 10;
}

/**
 * Auto-calculates Visceral Fat Index (1-30 scale similar to Huawei/Tanita/Garmin scales).
 */
export function calcVisceralFat(weightKg, heightCm, bodyFatPct, age = 28, sex = 'male') {
  const bmi = calcBMI(weightKg, heightCm);
  if (!bmi) return null;
  const bf = bodyFatPct != null && bodyFatPct > 0
    ? Number(bodyFatPct)
    : (1.20 * bmi + 0.23 * age - (sex === 'male' ? 16.2 : 5.4));

  const sexOffset = sex === 'male' ? 1.5 : -0.8;
  const raw = (bmi - 18) * 0.48 + (bf - 14) * 0.34 + (age - 20) * 0.08 + sexOffset;
  const clamped = Math.max(1, Math.min(30, raw));
  return Math.round(clamped * 10) / 10;
}

/**
 * Auto-calculates BMR (kcal/day) using Katch-McArdle (if Body Fat % is present)
 * blended with Mifflin-St Jeor for accuracy.
 */
export function calcBMR(weightKg, heightCm, age = 28, sex = 'male', bodyFatPct = null) {
  if (!weightKg || !heightCm) return null;
  const s = sex === 'male' ? 5 : -161;
  const mifflin = 10 * weightKg + 6.25 * heightCm - 5 * age + s;

  if (bodyFatPct != null && bodyFatPct > 2 && bodyFatPct < 60) {
    const lbm = weightKg * (1 - bodyFatPct / 100);
    const katch = 370 + 21.6 * lbm;
    return Math.round((katch * 0.65) + (mifflin * 0.35));
  }
  return Math.round(mifflin);
}

/**
 * Applies auto-calculations for BMI, Visceral Fat (unless manual override), and BMR (unless manual override),
 * plus optional smart estimates for companion metrics if the user clicks "Estimate Missing from Weight & BF%".
 */
export function computeAutoMetrics(record, profile) {
  const updated = { ...record };
  const weight = Number(updated.weight) || null;
  const bodyFat = updated.bodyFat != null && updated.bodyFat !== '' ? Number(updated.bodyFat) : null;

  if (weight) {
    updated.bmi = calcBMI(weight, profile.heightCm);

    if (!updated.visceralFatManual) {
      updated.visceralFat = calcVisceralFat(weight, profile.heightCm, bodyFat, profile.age, profile.sex);
    }

    if (profile.manualBmrOverride && !updated.bmrManual) {
      updated.bmr = Number(profile.manualBmrOverride);
    } else if (!updated.bmrManual) {
      updated.bmr = calcBMR(weight, profile.heightCm, profile.age, profile.sex, bodyFat);
    }
  }
  return updated;
}

/**
 * Estimates secondary smart-scale metrics from Weight + Body Fat % if the user wants 1-tap smart estimation.
 */
export function estimateSmartScaleComposition(weightKg, bodyFatPct, profile) {
  if (!weightKg) return {};
  const bmi = calcBMI(weightKg, profile.heightCm);
  const bf = bodyFatPct != null && bodyFatPct !== ''
    ? Number(bodyFatPct)
    : Math.round((1.20 * bmi + 0.23 * profile.age - (profile.sex === 'male' ? 16.2 : 5.4)) * 10) / 10;

  const lbm = weightKg * (1 - bf / 100);
  const boneMineral = Math.round((lbm * 0.033) * 100) / 100;
  const muscleMass = Math.round((lbm - boneMineral) * 10) / 10;
  const skeletalMuscle = Math.round((lbm * 0.54) * 10) / 10;
  const bodyWater = Math.round(((100 - bf) * 0.725) * 10) / 10;
  const proteinPct = Math.round(((100 - bf) * 0.215) * 10) / 10;

  return {
    bodyFat: bf,
    bmi,
    visceralFat: calcVisceralFat(weightKg, profile.heightCm, bf, profile.age, profile.sex),
    bmr: calcBMR(weightKg, profile.heightCm, profile.age, profile.sex, bf),
    skeletalMuscle,
    muscleMass,
    bodyWater,
    boneMineral,
    proteinPct
  };
}

/**
 * Computes Exponentially Weighted Moving Average (EWMA) Trend Weight across sorted daily records.
 */
export function computeTrendSeries(dailyRecords, alpha = 0.15) {
  const sorted = [...dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
  let currentTrend = null;
  const map = new Map();

  for (const rec of sorted) {
    if (rec.weight != null && rec.weight > 0) {
      const w = Number(rec.weight);
      if (currentTrend === null) {
        currentTrend = w;
      } else {
        currentTrend = alpha * w + (1 - alpha) * currentTrend;
      }
    }
    if (currentTrend !== null) {
      map.set(rec.date, Math.round(currentTrend * 100) / 100);
    }
  }
  return map;
}

/**
 * Adaptive TDEE & Macro Target Engine
 * Uses rolling 14-to-28 day calorie intake + EWMA trend weight delta to determine real expenditure.
 */
export function calculateAdaptiveTDEE(dailyRecords, allMeals, profile, targetDate) {
  const trendMap = computeTrendSeries(dailyRecords);

  // Gather last 21 days up to targetDate
  const endObj = new Date(targetDate + 'T12:00:00');
  const windowDays = 21;
  const mealCaloriesByDate = new Map();

  for (const meal of allMeals) {
    mealCaloriesByDate.set(meal.date, (mealCaloriesByDate.get(meal.date) || 0) + (Number(meal.calories) || 0));
  }

  const loggedCalories = [];
  const trendPoints = [];

  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(endObj);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const kcal = mealCaloriesByDate.get(dateStr);
    if (kcal && kcal >= 800) {
      loggedCalories.push(kcal);
    }
    if (trendMap.has(dateStr)) {
      trendPoints.push({ date: dateStr, dayIndex: windowDays - 1 - i, weight: trendMap.get(dateStr) });
    }
  }

  // Fallback baseline BMR * activity multiplier if insufficient data
  const latestRecord = [...dailyRecords]
    .filter(r => r.weight != null && r.date <= targetDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const currentWeight = latestRecord?.weight || 78;
  const currentBf = latestRecord?.bodyFat || null;
  const baseBmr = latestRecord?.bmr || calcBMR(currentWeight, profile.heightCm, profile.age, profile.sex, currentBf) || 1800;
  const formulaTdee = Math.round(baseBmr * 1.45);

  let adaptiveTdee = formulaTdee;
  let confidence = 'Formula Estimate (Log 5+ days of weight & meals for Adaptive TDEE)';
  let avgDailyIntake = loggedCalories.length
    ? Math.round(loggedCalories.reduce((a, b) => a + b, 0) / loggedCalories.length)
    : formulaTdee;
  let weeklyWeightTrendDelta = 0;

  if (loggedCalories.length >= 4 && trendPoints.length >= 3) {
    const first = trendPoints[0];
    const last = trendPoints[trendPoints.length - 1];
    const daysSpan = Math.max(1, last.dayIndex - first.dayIndex);
    const weightChangeKg = last.weight - first.weight;
    weeklyWeightTrendDelta = Math.round(((weightChangeKg / daysSpan) * 7) * 100) / 100;

    // 1 kg of tissue energy equivalent ~ 7700 kcal
    const dailySurplusOrDeficit = (weightChangeKg * 7700) / daysSpan;
    const rawTdee = Math.round(avgDailyIntake - dailySurplusOrDeficit);

    // Clamp & blend so early noisy data doesn't swing wildly
    const weightFactor = Math.min(1, loggedCalories.length / 10);
    adaptiveTdee = Math.round(rawTdee * weightFactor + formulaTdee * (1 - weightFactor));
    adaptiveTdee = Math.max(1200, Math.min(5000, adaptiveTdee));
    confidence = `Adaptive TDEE (${loggedCalories.length}d intake + EWMA trend)`;
  }

  // Compute Daily Calorie & Macro Targets
  const dayRecord = dailyRecords.find(r => r.date === targetDate);
  const trainingCalories = Math.max(0, Math.round(Number(dayRecord?.trainingCalories) || 0));
  const isTrainingDay = Boolean(dayRecord?.isTrainingDay || trainingCalories > 0);

  if (profile.manualOverrideEnabled) {
    const baseManualCalories = Number(profile.manualCalories) || 2200;
    const effectiveCalories = baseManualCalories + trainingCalories;
    const baseProtein = Number(profile.manualProtein) || 170;
    const baseCarbs = Number(profile.manualCarbs) || 220;
    const baseFat = Number(profile.manualFat) || 70;
    return {
      tdee: adaptiveTdee + trainingCalories,
      baseTdee: adaptiveTdee,
      bmr: baseBmr,
      avgDailyIntake,
      weeklyWeightTrendDelta,
      confidence,
      isTrainingDay,
      trainingCalories,
      baseCalories: baseManualCalories,
      calories: effectiveCalories,
      protein: baseProtein,
      carbs: baseCarbs + Math.round(trainingCalories / 4),
      fat: baseFat,
      modeLabel: trainingCalories > 0
        ? `Manual + Training (+${trainingCalories} kcal)`
        : 'Manual Override'
    };
  }

  // Goal delta from weeklyRateKg (e.g., -0.5 kg/wk = -550 kcal/day)
  const goalDailyDelta = Math.round(((Number(profile.weeklyRateKg) || 0) * 7700) / 7);
  const baseTargetCalories = Math.max(1200, Math.round(adaptiveTdee + goalDailyDelta));
  let targetCalories = baseTargetCalories;

  if (trainingCalories > 0) {
    targetCalories = baseTargetCalories + trainingCalories;
  } else if (profile.carbCyclingEnabled) {
    const boost = Number(profile.trainingDayCalorieBoost) || 200;
    targetCalories += isTrainingDay ? boost : -Math.round(boost * 0.65);
  }
  targetCalories = Math.max(1200, Math.round(targetCalories));

  // Protein Floor
  const refMass = (profile.proteinBasis === 'lean' && currentBf)
    ? currentWeight * (1 - currentBf / 100)
    : currentWeight;
  const proteinGrams = Math.round(refMass * (Number(profile.proteinPerKg) || 2.0));
  const proteinKcal = proteinGrams * 4;

  const fatPct = Math.max(15, Math.min(60, Number(profile.fatSharePct) || 28)) / 100;
  const fatKcal = baseTargetCalories * fatPct;
  const fatGrams = Math.max(35, Math.round(fatKcal / 9));
  const carbGrams = Math.max(30, Math.round((targetCalories - proteinKcal - fatGrams * 9) / 4));

  let modeLabel = 'Adaptive Coaching';
  if (trainingCalories > 0) {
    modeLabel = `Training (+${trainingCalories} kcal burned)`;
  } else if (profile.carbCyclingEnabled) {
    modeLabel = isTrainingDay ? 'Training Day (+Carb/Kcal)' : 'Rest Day (Baseline)';
  }

  return {
    tdee: adaptiveTdee,
    bmr: baseBmr,
    avgDailyIntake,
    weeklyWeightTrendDelta,
    confidence,
    isTrainingDay,
    trainingCalories,
    baseCalories: baseTargetCalories,
    calories: targetCalories,
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    modeLabel
  };
}
