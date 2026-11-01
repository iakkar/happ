/**
 * HAPP Main Application Controller
 * Mobile-First Pure Dark Mode Calendar Fitness, Biometrics, Hydration & AI Macro Tracker
 */

import {
  getProfile,
  saveProfile,
  getDailyRecord,
  saveDailyRecord,
  getAllDailyRecords,
  getMealsByDate,
  getAllMealLogs,
  addMealLog,
  deleteMealLog,
  getSavedItems,
  saveCustomItem,
  deleteSavedItem,
  getPhotosByDate,
  getAllPhotos,
  saveProgressPhoto,
  deleteProgressPhoto,
  exportFullBackup,
  importFullBackup
} from './db.js';

import {
  METRIC_DEFINITIONS,
  computeAutoMetrics,
  estimateSmartScaleComposition,
  computeTrendSeries,
  calculateAdaptiveTDEE
} from './engines/biometrics.js';

import {
  compressImageFile,
  analyzeMealWithGemini,
  analyzeScaleScreenshotWithGemini,
  testGeminiConnection,
  searchFoodCatalog
} from './engines/ai-parser.js';

import {
  buildTimeSeries,
  computeSeriesStats,
  renderMetricChart,
  renderCalorieTdeeChart
} from './engines/charts.js';

function toLocalDateStr(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- Global App State ---
const state = {
  selectedDate: toLocalDateStr(),
  activeTab: 'day', // 'day' | 'trends' | 'library' | 'settings'
  profile: null,
  dayRecord: null,
  allRecords: [],
  dayMeals: [],
  allMeals: [],
  savedItems: [],
  dayPhotos: [],
  allPhotos: [],
  tdeeSummary: null,
  // Analytics state
  chartRange: 'W', // 'W' | 'M' | 'Y'
  primaryMetricKey: 'weight',
  secondaryMetricKey: 'bodyFat',
  // Modal state
  pendingAiImage: null,
  pendingAiResult: null
};

const CUP_SVG = `<svg class="cup-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14l-1.5 15a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 4z"></path><line x1="6" y1="9" x2="18" y2="9"></line></svg>`;

export function showToast(msg) {
  const existing = document.querySelector('.toast-banner');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast-banner';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function formatDateReadable(dateStr) {
  const todayStr = toLocalDateStr();
  const d = new Date(dateStr + 'T12:00:00');
  const diffDays = Math.round((new Date(dateStr + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000);
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  let badge = '';
  if (diffDays === 0) badge = 'Today';
  else if (diffDays === -1) badge = 'Yesterday';
  else badge = d.getFullYear().toString();
  return { label, badge };
}

async function refreshState() {
  state.profile = await getProfile();
  state.allRecords = await getAllDailyRecords();
  state.dayRecord = await getDailyRecord(state.selectedDate);
  state.dayRecord = computeAutoMetrics(state.dayRecord, state.profile);
  state.dayMeals = await getMealsByDate(state.selectedDate);
  state.allMeals = await getAllMealLogs();
  state.savedItems = await getSavedItems();
  state.dayPhotos = await getPhotosByDate(state.selectedDate);
  state.allPhotos = await getAllPhotos();
  state.tdeeSummary = calculateAdaptiveTDEE(state.allRecords, state.allMeals, state.profile, state.selectedDate);
}

async function setDate(newDateStr) {
  const todayStr = toLocalDateStr();
  if (newDateStr > todayStr) {
    showToast('Cannot log data for future dates');
    return;
  }
  state.selectedDate = newDateStr;
  await refreshState();
  renderApp();
}

function shiftDate(deltaDays) {
  const d = new Date(state.selectedDate + 'T12:00:00');
  d.setDate(d.getDate() + deltaDays);
  const nextStr = toLocalDateStr(d);
  if (nextStr > toLocalDateStr()) return;
  setDate(nextStr);
}

// ============================================================================
// Calendar Top Header Renderer
// ============================================================================
function renderCalendarBar() {
  const bar = document.getElementById('top-calendar-bar');
  if (!bar) return;

  const todayStr = toLocalDateStr();
  const isTodaySelected = state.selectedDate >= todayStr;
  const { label, badge } = formatDateReadable(state.selectedDate);
  const selObj = new Date(state.selectedDate + 'T12:00:00');

  const dayOfWeek = selObj.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(selObj);
  monday.setDate(selObj.getDate() + mondayOffset);

  const dataDates = new Set([
    ...state.allRecords.filter(r => r.weight != null || (r.cups && r.cups > 0)).map(r => r.date),
    ...state.allMeals.map(m => m.date)
  ]);

  let weekHtml = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dStr = toLocalDateStr(d);
    const dow = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
    const dom = d.getDate();
    const isActive = dStr === state.selectedDate;
    const isFuture = dStr > todayStr;
    const hasData = dataDates.has(dStr);

    weekHtml += `
      <div class="day-pill ${isActive ? 'active' : ''} ${hasData ? 'has-data' : ''} ${isFuture ? 'future-disabled' : ''}" ${isFuture ? '' : `data-select-date="${dStr}"`}>
        <span class="dow">${dow}</span>
        <span class="dom">${dom}</span>
        <div class="day-dot"></div>
      </div>
    `;
  }

  bar.innerHTML = `
    <div class="calendar-header-row">
      <div class="date-title-group" id="btn-open-date-picker">
        <span class="date-main-label">${label}</span>
        <span class="date-sub-badge">${badge}</span>
      </div>
      <div class="calendar-actions">
        <button class="icon-btn" id="btn-prev-week" title="Previous Day">&lsaquo;</button>
        <button class="icon-btn" id="btn-today-jump" ${isTodaySelected ? 'disabled' : ''}>Today</button>
        <button class="icon-btn" id="btn-next-week" title="Next Day" ${isTodaySelected ? 'disabled' : ''}>&rsaquo;</button>
        <input type="date" id="native-date-picker" value="${state.selectedDate}" max="${todayStr}" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;" />
      </div>
    </div>
    <div class="week-strip">
      ${weekHtml}
    </div>
  `;

  bar.querySelectorAll('[data-select-date]').forEach(el => {
    el.addEventListener('click', () => setDate(el.getAttribute('data-select-date')));
  });
  bar.querySelector('#btn-prev-week')?.addEventListener('click', () => shiftDate(-1));
  bar.querySelector('#btn-next-week')?.addEventListener('click', () => shiftDate(1));
  bar.querySelector('#btn-today-jump')?.addEventListener('click', () => setDate(todayStr));

  const nativePicker = bar.querySelector('#native-date-picker');
  bar.querySelector('#btn-open-date-picker')?.addEventListener('click', () => {
    if (nativePicker.showPicker) nativePicker.showPicker();
    else nativePicker.click();
  });
  nativePicker?.addEventListener('change', (e) => {
    if (e.target.value) setDate(e.target.value);
  });
}

// ============================================================================
// TAB 1: "My Day" — Calendar Daily Dashboard
// ============================================================================
function getRangeTag(metricDef, val) {
  if (val == null || val === '' || !metricDef.ranges) return { text: 'Tap to log', color: '#64748b' };
  const num = Number(val);
  for (const r of metricDef.ranges) {
    if (num <= r.max) return { text: r.label, color: r.color };
  }
  const last = metricDef.ranges[metricDef.ranges.length - 1];
  return { text: last.label, color: last.color };
}

function renderMyDayView(container) {
  const rec = state.dayRecord;
  const prof = state.profile;
  const tdee = state.tdeeSummary;
  const trendMap = computeTrendSeries(state.allRecords);
  const currentTrendWeight = trendMap.get(state.selectedDate) || rec.weight || null;

  // Calculate today's consumed macros
  const totals = state.dayMeals.reduce(
    (acc, m) => {
      acc.calories += Number(m.calories) || 0;
      acc.protein += Number(m.protein) || 0;
      acc.carbs += Number(m.carbs) || 0;
      acc.fat += Number(m.fat) || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Build 9 secondary metric tiles under Weight Hero
  const secondaryMetrics = METRIC_DEFINITIONS.filter(m => m.key !== 'weight');
  const tilesHtml = secondaryMetrics.map(m => {
    const rawVal = rec[m.key];
    const hasVal = rawVal != null && rawVal !== '';
    const displayVal = hasVal ? Number(rawVal).toFixed(m.decimals) : '--';
    const tag = getRangeTag(m, rawVal);
    const autoBadge = m.autoCalculated
      ? `<span style="font-size:0.62rem;color:#38bdf8;">${m.key === 'bmr' && rec.bmrManual ? 'MANUAL' : 'AUTO'}</span>`
      : '';

    return `
      <div class="bio-tile" data-drill-metric="${m.key}">
        <div class="bio-tile-top">
          <span>${m.shortLabel}</span>
          ${autoBadge}
        </div>
        <div class="bio-tile-val">
          ${displayVal}<small>${m.unit}</small>
        </div>
        <span class="bio-tile-tag" style="color:${hasVal ? tag.color : '#64748b'}">
          ${hasVal ? tag.text : (m.autoCalculated ? 'Needs weight' : 'Tap to chart/edit')}
        </span>
      </div>
    `;
  }).join('');

  // Hydration Ring-Around-A-Cup Math (250ml per cup)
  const cupSizeMl = Number(prof.cupSizeMl) || 250;
  const goalCups = Math.max(1, Number(prof.hydrationGoalCups) || 10);
  const filledCups = Math.max(0, Number(rec.cups) || 0);
  const currentMl = filledCups * cupSizeMl;
  const goalMl = goalCups * cupSizeMl;
  const hydPct = Math.min(100, Math.round((filledCups / goalCups) * 100));
  const hydRadius = 56;
  const hydCirc = 2 * Math.PI * hydRadius;
  const hydDashOffset = hydCirc - (hydPct / 100) * hydCirc;

  // Calorie Ring SVG math
  const kcalPct = Math.min(100, Math.round((totals.calories / Math.max(1, tdee.calories)) * 100));
  const kcalRemaining = tdee.calories - totals.calories;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (kcalPct / 100) * circumference;

  const pPct = Math.min(100, Math.round((totals.protein / Math.max(1, tdee.protein)) * 100));
  const cPct = Math.min(100, Math.round((totals.carbs / Math.max(1, tdee.carbs)) * 100));
  const fPct = Math.min(100, Math.round((totals.fat / Math.max(1, tdee.fat)) * 100));

  // Optional Fasting Window Strip (Only shown if user enabled fasting, or shows an opt-in button)
  const fastingHtml = prof.fastingEnabled
    ? `
      <div class="fasting-strip">
        <div>
          <strong>${prof.fastingProtocol} Fasting Window</strong>
          <span style="color:var(--text-secondary);margin-left:6px;">Window: ${prof.eatingWindowStart}–${prof.eatingWindowEnd}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="icon-btn" id="btn-toggle-fast-state" style="padding:3px 8px;font-size:0.72rem;border-color:rgba(168,85,247,0.45);color:#d8b4fe;">
            ${rec.fastingStartedAt ? `Fasting since ${rec.fastingStartedAt} (End)` : 'Start Fast'}
          </button>
          <button class="delete-mini-btn" id="btn-disable-fasting" title="Turn off fasting tracker" style="font-size:0.8rem;">&times;</button>
        </div>
      </div>
    `
    : `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;margin-bottom:12px;background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);font-size:0.76rem;color:var(--text-muted);">
        <span>Intermittent Fasting Window is off</span>
        <button class="icon-btn" id="btn-enable-fasting" style="padding:3px 9px;font-size:0.72rem;">Enable Fasting</button>
      </div>
    `;

  // Group Meals by Slot
  const mealsBySlot = {};
  for (const slot of prof.mealSlots) mealsBySlot[slot] = [];
  for (const m of state.dayMeals) {
    if (!mealsBySlot[m.mealSlot]) mealsBySlot[m.mealSlot] = [];
    mealsBySlot[m.mealSlot].push(m);
  }

  let mealSlotsHtml = '';
  for (const [slotName, items] of Object.entries(mealsBySlot)) {
    if (items.length === 0) continue;
    const slotKcal = items.reduce((s, x) => s + (Number(x.calories) || 0), 0);
    mealSlotsHtml += `
      <div class="meal-slot-group">
        <div class="meal-slot-header">
          <span>${slotName}</span>
          <span>${slotKcal} kcal</span>
        </div>
        ${items.map(item => `
          <div class="meal-item-row">
            <div class="meal-item-info">
              <div class="meal-item-title">
                ${item.name}
              </div>
              <div class="meal-item-meta">
                ${item.timestamp || ''} • P: ${item.protein}g • C: ${item.carbs}g • F: ${item.fat}g
              </div>
            </div>
            <div class="meal-item-right">
              <span class="meal-item-kcal">${item.calories} kcal</span>
              <button class="delete-mini-btn" data-del-meal="${item.id}" title="Delete">&times;</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (!mealSlotsHtml) {
    mealSlotsHtml = `
      <div style="text-align:center;padding:14px 8px;color:var(--text-muted);font-size:0.82rem;">
        No meals logged for this day yet. Use AI Vision, Saved Meals, Search, or Manual Entry above.
      </div>
    `;
  }

  container.innerHTML = `
    <!-- CARD 1: MORNING WEIGH-IN & 10-METRIC SMART SCALE HUB -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Morning Weigh-In & Biometrics</div>
          <div class="h-card-sub">Tap any metric for W·M·Y trends</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="icon-btn" id="btn-scan-scale-screenshot" style="border-color:rgba(16,185,129,0.5);color:var(--accent-emerald);">
            Scan Screenshot
          </button>
          <button class="icon-btn" id="btn-open-weighin-modal" style="border-color:var(--accent-cyan);color:var(--accent-cyan);">
            + Log Scale
          </button>
        </div>
      </div>

      <div class="weighin-hero" id="hero-weight-box" style="cursor:pointer;">
        <div>
          <div style="font-size:0.74rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Morning Weight</div>
          <div class="weighin-main-val">
            ${rec.weight != null ? Number(rec.weight).toFixed(1) : '--.-'} <span>kg</span>
          </div>
          <div class="weighin-trend-line">
            EWMA Trend: <strong>${currentTrendWeight != null ? Number(currentTrendWeight).toFixed(1) + ' kg' : '--'}</strong>
            • TDEE: <strong>${tdee.tdee} kcal</strong>
          </div>
        </div>
        <div style="text-align:right;">
          <span class="badge-pill cyan">View W·M·Y</span>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;">
            BMI: <strong style="color:var(--text-primary);">${rec.bmi != null ? rec.bmi : '--'}</strong>
          </div>
        </div>
      </div>

      <div class="biometrics-grid">
        ${tilesHtml}
      </div>
    </section>

    <!-- CARD 2: HYDRATION (CIRCLE AROUND CUP WITH + / - & GOAL ADJUST) -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Hydration</div>
          <div class="h-card-sub">1 cup = ${cupSizeMl} ml • ${hydPct}% of daily goal</div>
        </div>
        <button class="icon-btn" id="btn-open-hydration-goal" style="font-size:0.75rem;">
          Goal: ${goalMl} ml (${goalCups} cups)
        </button>
      </div>

      <div class="hydration-circle-stage">
        <button class="hydration-step-btn" id="btn-Sub-Cup" ${filledCups <= 0 ? 'disabled' : ''} title="Remove 250ml cup">&minus;</button>

        <div class="hydration-ring-wrap">
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r="${hydRadius}" stroke="rgba(148,163,184,0.14)" stroke-width="9" fill="none" />
            <circle cx="66" cy="66" r="${hydRadius}" stroke="#38bdf8" stroke-width="9"
              fill="none" stroke-linecap="round"
              stroke-dasharray="${hydCirc}" stroke-dashoffset="${hydDashOffset}"
              transform="rotate(-90 66 66)" />
          </svg>
          <div class="hydration-ring-center">
            ${CUP_SVG}
            <span class="hyd-ml-main">${currentMl} ml</span>
            <span class="hyd-cups-sub">${filledCups} / ${goalCups} cups</span>
          </div>
        </div>

        <button class="hydration-step-btn" id="btn-Add-Cup" title="Add 250ml cup">+</button>
      </div>
    </section>

    <!-- CARD 3: MEALS, MACROS & GEMINI VISION AI -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Meals & Macro Coaching</div>
          <div class="h-card-sub">${tdee.modeLabel} • Target ${tdee.calories} kcal</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button class="icon-btn" id="btn-open-training-kcal-modal" style="padding:4px 9px;font-size:0.74rem;border-color:${tdee.trainingCalories > 0 ? 'var(--accent-amber)' : 'var(--border-subtle)'};color:${tdee.trainingCalories > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)'};">
            ${tdee.trainingCalories > 0 ? `+${tdee.trainingCalories} Training kcal` : '+ Training Kcal'}
          </button>
          <button class="badge-pill ${rec.isTrainingDay || tdee.trainingCalories > 0 ? 'emerald' : ''}" id="btn-toggle-training-day" style="cursor:pointer;">
            ${rec.isTrainingDay || tdee.trainingCalories > 0 ? 'Training Day' : 'Rest Day'}
          </button>
        </div>
      </div>

      <!-- Opt-In Fasting Window Strip -->
      ${fastingHtml}

      <!-- Garmin-Style Ring + Macro Progress Bars -->
      <div class="macro-hero-grid">
        <div class="kcal-ring-wrap">
          <svg width="112" height="112" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="${radius}" stroke="rgba(148,163,184,0.15)" stroke-width="9" fill="none" />
            <circle cx="56" cy="56" r="${radius}" stroke="${kcalRemaining >= 0 ? '#38bdf8' : '#f59e0b'}" stroke-width="9"
              fill="none" stroke-linecap="round"
              stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
              transform="rotate(-90 56 56)" />
          </svg>
          <div class="kcal-ring-center">
            <span class="kcal-num">${Math.abs(kcalRemaining)}</span>
            <span class="kcal-lbl">${kcalRemaining >= 0 ? 'kcal left' : 'kcal over'}</span>
          </div>
        </div>

        <div class="macro-bars-col">
          <div class="macro-bar-item">
            <div class="macro-bar-head">
              <span style="color:#ec4899;">Protein</span>
              <span>${Math.round(totals.protein)} / ${tdee.protein}g</span>
            </div>
            <div class="macro-track">
              <div class="macro-fill" style="width:${pPct}%;background:#ec4899;"></div>
            </div>
          </div>

          <div class="macro-bar-item">
            <div class="macro-bar-head">
              <span style="color:#10b981;">Carbs</span>
              <span>${Math.round(totals.carbs)} / ${tdee.carbs}g</span>
            </div>
            <div class="macro-track">
              <div class="macro-fill" style="width:${cPct}%;background:#10b981;"></div>
            </div>
          </div>

          <div class="macro-bar-item">
            <div class="macro-bar-head">
              <span style="color:#f59e0b;">Fat</span>
              <span>${Math.round(totals.fat)} / ${tdee.fat}g</span>
            </div>
            <div class="macro-track">
              <div class="macro-fill" style="width:${fPct}%;background:#f59e0b;"></div>
            </div>
          </div>

          <div style="font-size:0.72rem;color:var(--text-secondary);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;padding-top:2px;">
            <span>Eaten: <strong>${totals.calories} kcal</strong></span>
            <span>Training: <strong style="color:${tdee.trainingCalories > 0 ? '#f59e0b' : 'inherit'};">${tdee.trainingCalories > 0 ? '+' + tdee.trainingCalories : '0'} kcal</strong></span>
            <span>TDEE: <strong>${tdee.tdee} kcal</strong></span>
          </div>
        </div>
      </div>

      <!-- 4 Logging Mode Buttons -->
      <div class="meal-quick-actions">
        <button class="meal-action-btn ai-highlight" data-open-meal-modal="ai">
          <span>Gemini AI</span>
        </button>
        <button class="meal-action-btn" data-open-meal-modal="saved">
          <span>Saved Meals</span>
        </button>
        <button class="meal-action-btn" data-open-meal-modal="search">
          <span>Search Food</span>
        </button>
        <button class="meal-action-btn" data-open-meal-modal="manual">
          <span>Manual Macro</span>
        </button>
      </div>

      <!-- Logged Meals List -->
      ${mealSlotsHtml}
    </section>

    <!-- CARD 4: SLEEP, STEPS & READINESS BIOFEEDBACK (GARMIN STYLE) -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Sleep & Daily Readiness</div>
          <div class="h-card-sub">Recovery & step metrics for ${state.selectedDate}</div>
        </div>
        <button class="icon-btn" id="btn-open-readiness-modal">Edit</button>
      </div>

      <div class="readiness-grid" id="readiness-cards-trigger">
        <div class="readiness-box">
          <div class="r-lbl">Sleep</div>
          <div class="r-val" style="color:#a855f7;">${rec.sleepHours != null ? rec.sleepHours + 'h' : '--'}</div>
          <div class="r-lbl">${rec.sleepQuality != null ? 'Score ' + rec.sleepQuality : 'Tap'}</div>
        </div>
        <div class="readiness-box">
          <div class="r-lbl">Energy</div>
          <div class="r-val" style="color:#10b981;">${rec.energy != null ? rec.energy + '/5' : '--'}</div>
          <div class="r-lbl">Readiness</div>
        </div>
        <div class="readiness-box">
          <div class="r-lbl">Soreness</div>
          <div class="r-val" style="color:#f59e0b;">${rec.soreness != null ? rec.soreness + '/5' : '--'}</div>
          <div class="r-lbl">Recovery</div>
        </div>
        <div class="readiness-box">
          <div class="r-lbl">Steps</div>
          <div class="r-val" style="color:#38bdf8;">${rec.steps != null ? Number(rec.steps).toLocaleString() : '--'}</div>
          <div class="r-lbl">Daily</div>
        </div>
      </div>
    </section>

    <!-- CARD 5: DAILY PROGRESS PHOTOS -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Progress Photos</div>
          <div class="h-card-sub">Auto-stamped with ${state.selectedDate} Weight & Body Fat %</div>
        </div>
        <button class="icon-btn" id="btn-open-photo-modal">+ Add Photo</button>
      </div>

      ${state.dayPhotos.length === 0 ? `
        <div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.8rem;">
          No physique photo attached to ${state.selectedDate}.
        </div>
      ` : `
        <div class="photo-compare-grid">
          ${state.dayPhotos.map(p => `
            <div class="photo-card">
              <img src="${p.dataUrl}" alt="${p.pose}" />
              <div class="photo-overlay-badge">
                <span><strong>${p.pose}</strong> (${p.state})</span>
                <span>${p.weight ? p.weight + 'kg' : ''} ${p.bodyFat ? '• ' + p.bodyFat + '%' : ''}</span>
              </div>
              <button class="delete-mini-btn" data-del-photo="${p.id}" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.7);border-radius:50%;width:24px;height:24px;color:#fff;">&times;</button>
            </div>
          `).join('')}
        </div>
      `}
    </section>
  `;

  // Wire up Card 1: Weigh-in Modal, Screenshot Scanner & Metric Drill-Downs
  container.querySelector('#btn-open-weighin-modal')?.addEventListener('click', () => openWeighInModal(false));
  container.querySelector('#btn-scan-scale-screenshot')?.addEventListener('click', () => openWeighInModal(true));
  container.querySelector('#hero-weight-box')?.addEventListener('click', () => openMetricDrillModal('weight'));
  container.querySelectorAll('[data-drill-metric]').forEach(tile => {
    tile.addEventListener('click', () => openMetricDrillModal(tile.getAttribute('data-drill-metric')));
  });

  // Wire up Card 2: Hydration Circle + / - and Adjustable Goal Modal
  const updateCups = async (newCount) => {
    const clamped = Math.max(0, Math.min(40, newCount));
    await saveDailyRecord(state.selectedDate, { cups: clamped });
    await refreshState();
    renderApp();
  };
  container.querySelector('#btn-Add-Cup')?.addEventListener('click', () => updateCups(filledCups + 1));
  container.querySelector('#btn-Sub-Cup')?.addEventListener('click', () => updateCups(filledCups - 1));
  container.querySelector('#btn-open-hydration-goal')?.addEventListener('click', () => openHydrationGoalModal());

  // Wire up Card 3: Fasting Opt-in / Start / Stop & Training Day Toggle
  container.querySelector('#btn-enable-fasting')?.addEventListener('click', () => openFastingConfigModal());
  container.querySelector('#btn-disable-fasting')?.addEventListener('click', async () => {
    await saveProfile({ fastingEnabled: false });
    await refreshState();
    renderApp();
    showToast('Fasting window turned off');
  });
  container.querySelector('#btn-toggle-fast-state')?.addEventListener('click', async () => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    const nextVal = rec.fastingStartedAt ? null : nowTime;
    await saveDailyRecord(state.selectedDate, { fastingStartedAt: nextVal });
    await refreshState();
    renderApp();
    showToast(nextVal ? `Fast started at ${nextVal}` : 'Fast ended');
  });

  container.querySelector('#btn-open-training-kcal-modal')?.addEventListener('click', () => openTrainingCaloriesModal());

  container.querySelector('#btn-toggle-training-day')?.addEventListener('click', async () => {
    await saveDailyRecord(state.selectedDate, { isTrainingDay: !rec.isTrainingDay });
    await refreshState();
    renderApp();
    showToast(!rec.isTrainingDay ? 'Switched to Training Day Targets' : 'Switched to Rest Day Targets');
  });

  container.querySelectorAll('[data-open-meal-modal]').forEach(btn => {
    btn.addEventListener('click', () => openMealLoggerModal(btn.getAttribute('data-open-meal-modal')));
  });

  container.querySelectorAll('[data-del-meal]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteMealLog(btn.getAttribute('data-del-meal'));
      await refreshState();
      renderApp();
      showToast('Meal entry removed');
    });
  });

  // Wire up Card 4: Sleep & Readiness
  container.querySelector('#btn-open-readiness-modal')?.addEventListener('click', () => openReadinessModal());
  container.querySelector('#readiness-cards-trigger')?.addEventListener('click', () => openReadinessModal());

  // Wire up Card 5: Progress Photos
  container.querySelector('#btn-open-photo-modal')?.addEventListener('click', () => openPhotoUploadModal());
  container.querySelectorAll('[data-del-photo]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteProgressPhoto(btn.getAttribute('data-del-photo'));
      await refreshState();
      renderApp();
    });
  });
}

// ============================================================================
// TAB 2: "Trends & Charts" — Huawei Health + Garmin Connect W | M | Y Analytics
// ============================================================================
function renderTrendsView(container) {
  const series = buildTimeSeries(state.allRecords, state.allMeals, state.selectedDate, state.chartRange);
  const primaryDef = METRIC_DEFINITIONS.find(m => m.key === state.primaryMetricKey) || METRIC_DEFINITIONS[0];
  const secondaryDef = METRIC_DEFINITIONS.find(m => m.key === state.secondaryMetricKey) || null;
  const stats = computeSeriesStats(series, primaryDef.key, primaryDef.decimals);
  const tdee = state.tdeeSummary;

  const chipsHtml = METRIC_DEFINITIONS.map(m => `
    <button class="metric-chip ${m.key === state.primaryMetricKey ? 'active' : ''}" data-select-primary="${m.key}">
      ${m.shortLabel}
    </button>
  `).join('');

  const secondaryOptions = [
    `<option value="">None (Single Metric + EWMA Trend)</option>`,
    ...METRIC_DEFINITIONS.filter(m => m.key !== state.primaryMetricKey).map(m =>
      `<option value="${m.key}" ${m.key === state.secondaryMetricKey ? 'selected' : ''}>Overlay: ${m.label} (${m.unit || 'idx'})</option>`
    ),
    `<option value="sleepHours" ${state.secondaryMetricKey === 'sleepHours' ? 'selected' : ''}>Overlay: Sleep Hours (h)</option>`,
    `<option value="steps" ${state.secondaryMetricKey === 'steps' ? 'selected' : ''}>Overlay: Daily Steps</option>`,
    `<option value="calories" ${state.secondaryMetricKey === 'calories' ? 'selected' : ''}>Overlay: Calorie Intake (kcal)</option>`
  ].join('');

  container.innerHTML = `
    <!-- Top Range Selector Card -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Biometrics & Health Analytics</div>
          <div class="h-card-sub">Huawei Health & Garmin Connect style period trends</div>
        </div>
        <div class="segmented-tabs">
          <button class="seg-btn ${state.chartRange === 'W' ? 'active' : ''}" data-range="W">W</button>
          <button class="seg-btn ${state.chartRange === 'M' ? 'active' : ''}" data-range="M">M</button>
          <button class="seg-btn ${state.chartRange === 'Y' ? 'active' : ''}" data-range="Y">Y</button>
        </div>
      </div>

      <!-- 10-Metric Selector Strip -->
      <div class="metric-chip-scroller">
        ${chipsHtml}
      </div>

      <!-- Dual-Metric Overlay Picker -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <span style="font-size:0.78rem;color:var(--text-secondary);font-weight:600;">
          ${primaryDef.label} (${state.chartRange === 'W' ? '7 Days' : state.chartRange === 'M' ? '30 Days' : '12 Months'})
        </span>
        <select class="form-select" id="select-secondary-overlay" style="padding:4px 8px;font-size:0.74rem;max-width:210px;">
          ${secondaryOptions}
        </select>
      </div>

      <!-- Main Interactive Canvas -->
      <div class="chart-canvas-wrap">
        <canvas id="canvas-main-biometric"></canvas>
      </div>

      <!-- 4 Summary Stat Tiles -->
      <div class="stats-strip-4">
        <div class="stat-mini-card">
          <div class="s-lbl">Latest</div>
          <div class="s-val" style="color:${primaryDef.color};">${stats.latest != null ? stats.latest : '--'} <small>${primaryDef.unit}</small></div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">Period Avg</div>
          <div class="s-val">${stats.avg != null ? stats.avg : '--'} <small>${primaryDef.unit}</small></div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">Min / Max</div>
          <div class="s-val" style="font-size:0.8rem;">${stats.min != null ? `${stats.min}–${stats.max}` : '--'}</div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">Change (Δ)</div>
          <div class="s-val" style="color:${stats.delta > 0 ? '#f59e0b' : stats.delta < 0 ? '#10b981' : 'var(--text-primary)'};">
            ${stats.delta != null ? (stats.delta > 0 ? '+' + stats.delta : stats.delta) : '--'}
          </div>
        </div>
      </div>
    </section>

    <!-- Adaptive TDEE & Calorie Expenditure Chart -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Calorie Intake vs. Adaptive TDEE</div>
          <div class="h-card-sub">${tdee.confidence}</div>
        </div>
        <span class="badge-pill emerald">TDEE: ${tdee.tdee} kcal</span>
      </div>

      <div class="chart-canvas-wrap" style="height:185px;">
        <canvas id="canvas-calorie-tdee"></canvas>
      </div>

      <div class="stats-strip-4">
        <div class="stat-mini-card">
          <div class="s-lbl">Est. TDEE</div>
          <div class="s-val" style="color:#ef4444;">${tdee.tdee}</div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">Avg Intake</div>
          <div class="s-val" style="color:#10b981;">${tdee.avgDailyIntake}</div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">Target Kcal</div>
          <div class="s-val" style="color:#00e5ff;">${tdee.calories}</div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">Trend Rate</div>
          <div class="s-val">${tdee.weeklyWeightTrendDelta > 0 ? '+' : ''}${tdee.weeklyWeightTrendDelta}kg/w</div>
        </div>
      </div>
    </section>

    <!-- Side-by-Side Progress Photo Comparison Card -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Side-by-Side Photo Compare</div>
          <div class="h-card-sub">Compare any two dates from your progress gallery (${state.allPhotos.length} total)</div>
        </div>
      </div>
      ${renderPhotoComparisonWidget()}
    </section>
  `;

  // Bind controls
  container.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.chartRange = btn.getAttribute('data-range');
      renderTrendsView(container);
    });
  });

  container.querySelectorAll('[data-select-primary]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.primaryMetricKey = btn.getAttribute('data-select-primary');
      if (state.secondaryMetricKey === state.primaryMetricKey) state.secondaryMetricKey = '';
      renderTrendsView(container);
    });
  });

  container.querySelector('#select-secondary-overlay')?.addEventListener('change', (e) => {
    state.secondaryMetricKey = e.target.value;
    renderTrendsView(container);
  });

  // Render Canvases
  requestAnimationFrame(() => {
    const mainCanvas = document.getElementById('canvas-main-biometric');
    renderMetricChart(mainCanvas, series, {
      primaryKey: primaryDef.key,
      primaryColor: primaryDef.color,
      secondaryKey: state.secondaryMetricKey || null,
      secondaryColor: secondaryDef?.color || '#f59e0b',
      showTrendLine: true,
      decimals: primaryDef.decimals
    });

    const kcalCanvas = document.getElementById('canvas-calorie-tdee');
    renderCalorieTdeeChart(kcalCanvas, series, tdee.tdee, tdee.calories);
  });

  bindPhotoComparisonEvents(container);
}

function renderPhotoComparisonWidget() {
  if (state.allPhotos.length < 2) {
    return `
      <div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.8rem;">
        Upload at least 2 progress photos on different days to use Side-by-Side Comparison.
      </div>
    `;
  }
  const leftPhoto = state.allPhotos[state.allPhotos.length - 1];
  const rightPhoto = state.allPhotos[0];

  const optionsFor = (selectedId) => state.allPhotos.map(p =>
    `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.date} • ${p.pose} (${p.weight ? p.weight + 'kg' : 'No wt'})</option>`
  ).join('');

  return `
    <div class="photo-compare-grid">
      <div>
        <select class="form-select" id="compare-photo-left" style="width:100%;margin-bottom:6px;font-size:0.74rem;padding:5px;">
          ${optionsFor(leftPhoto.id)}
        </select>
        <div class="photo-card" id="compare-card-left">
          <img src="${leftPhoto.dataUrl}" alt="Before" />
          <div class="photo-overlay-badge">
            <span>${leftPhoto.date}</span>
            <span>${leftPhoto.weight ? leftPhoto.weight + 'kg' : ''}</span>
          </div>
        </div>
      </div>
      <div>
        <select class="form-select" id="compare-photo-right" style="width:100%;margin-bottom:6px;font-size:0.74rem;padding:5px;">
          ${optionsFor(rightPhoto.id)}
        </select>
        <div class="photo-card" id="compare-card-right">
          <img src="${rightPhoto.dataUrl}" alt="After" />
          <div class="photo-overlay-badge">
            <span>${rightPhoto.date}</span>
            <span>${rightPhoto.weight ? rightPhoto.weight + 'kg' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindPhotoComparisonEvents(container) {
  const updateCard = (selectId, cardId) => {
    const sel = container.querySelector(selectId);
    const card = container.querySelector(cardId);
    if (!sel || !card) return;
    sel.addEventListener('change', () => {
      const p = state.allPhotos.find(x => x.id === sel.value);
      if (p) {
        card.innerHTML = `
          <img src="${p.dataUrl}" alt="${p.pose}" />
          <div class="photo-overlay-badge">
            <span>${p.date}</span>
            <span>${p.weight ? p.weight + 'kg' : ''}</span>
          </div>
        `;
      }
    });
  };
  updateCard('#compare-photo-left', '#compare-card-left');
  updateCard('#compare-photo-right', '#compare-card-right');
}

// ============================================================================
// TAB 3: "Saved Meals & Foods Library" — Reusable Meals + AI Auto-Calc
// ============================================================================
function renderLibraryView(container) {
  const savedMeals = state.savedItems.filter(i => i.itemType === 'meal');
  const savedFoods = state.savedItems.filter(i => i.itemType === 'food');

  container.innerHTML = `
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Saved Reusable Meals</div>
          <div class="h-card-sub">Create once (manual or AI auto-calculated) & log with 1 tap</div>
        </div>
        <button class="icon-btn" id="btn-new-saved-meal" style="border-color:var(--accent-cyan);color:var(--accent-cyan);">
          + New Meal
        </button>
      </div>

      ${savedMeals.length === 0 ? `
        <div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.82rem;">
          No saved meals yet. Create your go-to breakfasts, shakes, or bowls above.
        </div>
      ` : savedMeals.map(m => `
        <div class="meal-item-row">
          <div class="meal-item-info">
            <div class="meal-item-title">${m.name}</div>
            <div class="meal-item-meta">
              P: ${m.protein}g • C: ${m.carbs}g • F: ${m.fat}g ${m.ingredientsText ? '• ' + m.ingredientsText : ''}
            </div>
          </div>
          <div class="meal-item-right">
            <span class="meal-item-kcal">${m.calories} kcal</span>
            <button class="icon-btn" data-quick-log-saved="${m.id}" style="padding:4px 8px;font-size:0.74rem;border-color:var(--accent-emerald);color:var(--accent-emerald);">+ Log</button>
            <button class="delete-mini-btn" data-del-saved="${m.id}">&times;</button>
          </div>
        </div>
      `).join('')}
    </section>

    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Registered Snacks & Custom Foods</div>
          <div class="h-card-sub">Your personal food & snack registry (searchable alongside 40+ staples)</div>
        </div>
        <button class="icon-btn" id="btn-new-saved-food">+ Register Food</button>
      </div>

      ${savedFoods.length === 0 ? `
        <div style="text-align:center;padding:14px;color:var(--text-muted);font-size:0.82rem;">
          No custom snacks registered yet. Built-in staples (chicken, rice, oats, whey, eggs, etc.) are already active in Search.
        </div>
      ` : savedFoods.map(f => `
        <div class="meal-item-row">
          <div class="meal-item-info">
            <div class="meal-item-title">${f.name} ${f.brand ? `<small style="color:var(--text-muted);">(${f.brand})</small>` : ''}</div>
            <div class="meal-item-meta">
              Per ${f.servingSize}${f.servingUnit}: P ${f.protein}g • C ${f.carbs}g • F ${f.fat}g
            </div>
          </div>
          <div class="meal-item-right">
            <span class="meal-item-kcal">${f.calories} kcal</span>
            <button class="delete-mini-btn" data-del-saved="${f.id}">&times;</button>
          </div>
        </div>
      `).join('')}
    </section>
  `;

  container.querySelector('#btn-new-saved-meal')?.addEventListener('click', () => openCreateSavedItemModal('meal'));
  container.querySelector('#btn-new-saved-food')?.addEventListener('click', () => openCreateSavedItemModal('food'));

  container.querySelectorAll('[data-quick-log-saved]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = state.savedItems.find(x => x.id === btn.getAttribute('data-quick-log-saved'));
      if (!item) return;
      await addMealLog({
        date: state.selectedDate,
        mealSlot: 'Lunch',
        name: item.name,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        source: 'saved_meal'
      });
      await refreshState();
      showToast(`Logged "${item.name}" to ${state.selectedDate}`);
    });
  });

  container.querySelectorAll('[data-del-saved]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteSavedItem(btn.getAttribute('data-del-saved'));
      await refreshState();
      renderLibraryView(container);
      showToast('Item deleted from library');
    });
  });
}

// ============================================================================
// TAB 4: "Profile, Gemini AI Key & Goals"
// ============================================================================
function renderSettingsView(container) {
  const p = state.profile;

  container.innerHTML = `
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Gemini Vision & AI Configuration</div>
          <div class="h-card-sub">Used for photo macro recognition & saved meal auto-calculation</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">
          <span>Google Gemini API Key</span>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent-cyan);text-decoration:none;">Get Free Key &nearr;</a>
        </label>
        <input type="password" class="form-input" id="set-gemini-key" value="${p.geminiApiKey || ''}" placeholder="AIzaSy..." />
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Gemini Model</label>
          <select class="form-select" id="set-gemini-model">
            <option value="gemini-3.1-pro-preview" ${p.geminiModel === 'gemini-3.1-pro-preview' ? 'selected' : ''}>gemini-3.1-pro-preview (Latest Pro)</option>
            <option value="gemini-3-flash-preview" ${p.geminiModel === 'gemini-3-flash-preview' ? 'selected' : ''}>gemini-3-flash-preview (Fast Vision)</option>
            <option value="gemini-2.5-flash" ${p.geminiModel === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash</option>
            <option value="gemini-3.1-flash-lite-preview" ${p.geminiModel === 'gemini-3.1-flash-lite-preview' ? 'selected' : ''}>gemini-3.1-flash-lite-preview</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">USDA FoodData API Key</label>
          <input type="text" class="form-input" id="set-usda-key" value="${p.usdaApiKey || 'DEMO_KEY'}" />
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:2px;">
        <button class="btn-secondary" id="btn-test-gemini-key" style="font-size:0.8rem;border-color:rgba(56,189,248,0.4);color:var(--accent-cyan);">
          Test Gemini API Key
        </button>
        <span id="gemini-test-status" style="font-size:0.76rem;color:var(--text-secondary);flex:1;min-width:160px;">
          ${p.geminiApiKey ? `Current model: ${p.geminiModel}` : 'No API key saved yet'}
        </span>
      </div>
    </section>

    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Body Profile, BMR & Macro Coaching</div>
          <div class="h-card-sub">Powers BMI, Visceral Fat, BMR & Adaptive TDEE targets</div>
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Height (cm)</label>
          <input type="number" class="form-input" id="set-height" value="${p.heightCm}" />
        </div>
        <div class="form-group">
          <label class="form-label">Age</label>
          <input type="number" class="form-input" id="set-age" value="${p.age}" />
        </div>
        <div class="form-group">
          <label class="form-label">Biological Sex</label>
          <select class="form-select" id="set-sex">
            <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option>
            <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Manual BMR Override (kcal)</label>
          <input type="number" class="form-input" id="set-bmr-override" value="${p.manualBmrOverride || ''}" placeholder="Auto-calculated if blank" />
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Weekly Weight Goal (kg/wk)</label>
          <select class="form-select" id="set-weekly-rate">
            <option value="-0.75" ${Number(p.weeklyRateKg) === -0.75 ? 'selected' : ''}>Aggressive Cut (-0.75 kg/wk)</option>
            <option value="-0.5" ${Number(p.weeklyRateKg) === -0.5 ? 'selected' : ''}>Standard Cut (-0.50 kg/wk)</option>
            <option value="-0.25" ${Number(p.weeklyRateKg) === -0.25 ? 'selected' : ''}>Mini Cut (-0.25 kg/wk)</option>
            <option value="0" ${Number(p.weeklyRateKg) === 0 ? 'selected' : ''}>Maintenance (0.0 kg/wk)</option>
            <option value="0.25" ${Number(p.weeklyRateKg) === 0.25 ? 'selected' : ''}>Lean Bulk (+0.25 kg/wk)</option>
            <option value="0.5" ${Number(p.weeklyRateKg) === 0.5 ? 'selected' : ''}>Standard Bulk (+0.50 kg/wk)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Protein Target (g/kg)</label>
          <input type="number" step="0.1" class="form-input" id="set-protein-kg" value="${p.proteinPerKg}" />
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Hydration Goal (250ml Cups)</label>
          <input type="number" class="form-input" id="set-hydration-cups" value="${p.hydrationGoalCups}" />
        </div>
        <div class="form-group">
          <label class="form-label">Fasting Protocol</label>
          <select class="form-select" id="set-fasting-proto">
            <option value="16:8" ${p.fastingProtocol === '16:8' ? 'selected' : ''}>16:8 Intermittent Fasting</option>
            <option value="18:6" ${p.fastingProtocol === '18:6' ? 'selected' : ''}>18:6 Fasting</option>
            <option value="20:4" ${p.fastingProtocol === '20:4' ? 'selected' : ''}>20:4 Warrior Window</option>
            <option value="14:10" ${p.fastingProtocol === '14:10' ? 'selected' : ''}>14:10 Gentle Window</option>
          </select>
        </div>
      </div>

      <div class="form-group" style="margin-top:4px;">
        <label class="form-label" style="cursor:pointer;">
          <span>Enable Intermittent Fasting Window Tracker</span>
          <input type="checkbox" id="set-fasting-enabled" ${p.fastingEnabled ? 'checked' : ''} />
        </label>
      </div>

      <div class="form-group" style="margin-top:6px;">
        <label class="form-label" style="cursor:pointer;">
          <span>Pin Manual Daily Macro Override (Bypass Adaptive Coaching)</span>
          <input type="checkbox" id="set-manual-override" ${p.manualOverrideEnabled ? 'checked' : ''} />
        </label>
      </div>

      <div class="form-grid-2" id="manual-macros-box" style="${p.manualOverrideEnabled ? '' : 'opacity:0.45;'}">
        <div class="form-group">
          <label class="form-label">Manual Calories</label>
          <input type="number" class="form-input" id="set-man-kcal" value="${p.manualCalories}" />
        </div>
        <div class="form-group">
          <label class="form-label">Manual Protein (g)</label>
          <input type="number" class="form-input" id="set-man-p" value="${p.manualProtein}" />
        </div>
        <div class="form-group">
          <label class="form-label">Manual Carbs (g)</label>
          <input type="number" class="form-input" id="set-man-c" value="${p.manualCarbs}" />
        </div>
        <div class="form-group">
          <label class="form-label">Manual Fat (g)</label>
          <input type="number" class="form-input" id="set-man-f" value="${p.manualFat}" />
        </div>
      </div>

      <button class="btn-primary" id="btn-save-settings" style="margin-top:8px;">Save Settings</button>
    </section>

    <!-- Backup Export/Import -->
    <section class="h-card">
      <div class="h-card-header">
        <div>
          <div class="h-card-title">Offline Data Backup</div>
          <div class="h-card-sub">100% stored in your browser's IndexedDB</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <button class="btn-secondary" id="btn-export-backup" style="flex:1 1 140px;">Export JSON Backup</button>
        <button class="btn-secondary" id="btn-import-backup" style="flex:1 1 140px;">Import Backup</button>
        <input type="file" id="file-import-backup" accept=".json" style="display:none;" />
      </div>
    </section>
  `;

  const manToggle = container.querySelector('#set-manual-override');
  const manBox = container.querySelector('#manual-macros-box');
  manToggle?.addEventListener('change', () => {
    if (manBox) manBox.style.opacity = manToggle.checked ? '1' : '0.45';
  });

  container.querySelector('#btn-test-gemini-key')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-test-gemini-key');
    const statusEl = container.querySelector('#gemini-test-status');
    const keyInp = container.querySelector('#set-gemini-key');
    const modelSel = container.querySelector('#set-gemini-model');

    btn.disabled = true;
    btn.textContent = 'Testing...';
    statusEl.textContent = 'Verifying key & checking available Gemini models...';
    statusEl.style.color = 'var(--text-secondary)';

    try {
      const { workingModel, availableModels } = await testGeminiConnection(keyInp.value, modelSel.value);
      modelSel.innerHTML = availableModels.slice(0, 8).map(m =>
        `<option value="${m}" ${m === workingModel ? 'selected' : ''}>${m}</option>`
      ).join('');
      await saveProfile({
        geminiApiKey: keyInp.value.trim(),
        geminiModel: workingModel
      });
      await refreshState();
      statusEl.textContent = `Connected — Active model: ${workingModel}`;
      statusEl.style.color = 'var(--accent-emerald)';
      showToast(`Verified: ${workingModel} is active`);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.style.color = 'var(--accent-danger)';
      showToast(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test Gemini API Key';
    }
  });

  container.querySelector('#btn-save-settings')?.addEventListener('click', async () => {
    const bmrVal = container.querySelector('#set-bmr-override').value;
    await saveProfile({
      geminiApiKey: container.querySelector('#set-gemini-key').value.trim(),
      geminiModel: container.querySelector('#set-gemini-model').value,
      usdaApiKey: container.querySelector('#set-usda-key').value.trim() || 'DEMO_KEY',
      heightCm: Number(container.querySelector('#set-height').value) || 178,
      age: Number(container.querySelector('#set-age').value) || 28,
      sex: container.querySelector('#set-sex').value,
      manualBmrOverride: bmrVal ? Number(bmrVal) : null,
      weeklyRateKg: Number(container.querySelector('#set-weekly-rate').value),
      proteinPerKg: Number(container.querySelector('#set-protein-kg').value) || 2.0,
      hydrationGoalCups: Number(container.querySelector('#set-hydration-cups').value) || 10,
      fastingEnabled: container.querySelector('#set-fasting-enabled').checked,
      fastingProtocol: container.querySelector('#set-fasting-proto').value,
      manualOverrideEnabled: container.querySelector('#set-manual-override').checked,
      manualCalories: Number(container.querySelector('#set-man-kcal').value) || 2200,
      manualProtein: Number(container.querySelector('#set-man-p').value) || 170,
      manualCarbs: Number(container.querySelector('#set-man-c').value) || 220,
      manualFat: Number(container.querySelector('#set-man-f').value) || 70
    });
    await refreshState();
    showToast('Profile & Coaching Settings Saved');
  });

  container.querySelector('#btn-export-backup')?.addEventListener('click', async () => {
    const backup = await exportFullBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `happ-backup-${state.selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON downloaded');
  });

  const fileInput = container.querySelector('#file-import-backup');
  container.querySelector('#btn-import-backup')?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importFullBackup(JSON.parse(text));
      await refreshState();
      renderApp();
      showToast('Backup restored');
    } catch (err) {
      showToast('Import failed: ' + err.message);
    }
  });
}

// ============================================================================
// MODALS
// ============================================================================
function openModal(htmlContent, onMount) {
  const backdrop = document.getElementById('modal-backdrop');
  const sheet = document.getElementById('modal-sheet');
  if (!backdrop || !sheet) return;
  sheet.innerHTML = htmlContent;
  backdrop.classList.remove('hidden');

  sheet.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
  if (onMount) onMount(sheet);
}

export function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

// --- Modal: Adjustable Hydration Goal ---
function openHydrationGoalModal() {
  const prof = state.profile;
  const currentCups = Number(prof.hydrationGoalCups) || 10;
  const cupSize = Number(prof.cupSizeMl) || 250;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Adjust Daily Hydration Goal</div>
      <button class="icon-btn" data-close-modal>&times;</button>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Daily Goal (Cups of ${cupSize}ml)</label>
        <input type="number" min="1" max="40" class="form-input" id="inp-hyd-goal-cups" value="${currentCups}" />
      </div>
      <div class="form-group">
        <label class="form-label">Total Volume (ml)</label>
        <input type="number" step="250" min="250" max="10000" class="form-input" id="inp-hyd-goal-ml" value="${currentCups * cupSize}" />
      </div>
    </div>

    <button class="btn-primary" id="btn-save-hyd-goal" style="margin-top:6px;">Save Hydration Goal</button>
  `, (sheet) => {
    const cupsInp = sheet.querySelector('#inp-hyd-goal-cups');
    const mlInp = sheet.querySelector('#inp-hyd-goal-ml');

    cupsInp.addEventListener('input', () => {
      const c = Math.max(1, Number(cupsInp.value) || 1);
      mlInp.value = c * cupSize;
    });
    mlInp.addEventListener('input', () => {
      const m = Math.max(cupSize, Number(mlInp.value) || cupSize);
      cupsInp.value = Math.max(1, Math.round(m / cupSize));
    });

    sheet.querySelector('#btn-save-hyd-goal')?.addEventListener('click', async () => {
      const newCups = Math.max(1, Math.min(40, Number(cupsInp.value) || 10));
      await saveProfile({ hydrationGoalCups: newCups });
      await refreshState();
      closeModal();
      renderApp();
      showToast(`Hydration goal set to ${newCups * cupSize} ml (${newCups} cups)`);
    });
  });
}

// --- Modal: Opt-In Fasting Window Setup ---
function openFastingConfigModal() {
  const prof = state.profile;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Intermittent Fasting Setup</div>
      <button class="icon-btn" data-close-modal>&times;</button>
    </div>

    <div class="form-group">
      <label class="form-label">Fasting Protocol</label>
      <select class="form-select" id="inp-fast-proto">
        <option value="16:8" ${prof.fastingProtocol === '16:8' ? 'selected' : ''}>16:8 (16h Fast / 8h Eating Window)</option>
        <option value="18:6" ${prof.fastingProtocol === '18:6' ? 'selected' : ''}>18:6 (18h Fast / 6h Eating Window)</option>
        <option value="20:4" ${prof.fastingProtocol === '20:4' ? 'selected' : ''}>20:4 (20h Fast / 4h Eating Window)</option>
        <option value="14:10" ${prof.fastingProtocol === '14:10' ? 'selected' : ''}>14:10 (14h Fast / 10h Eating Window)</option>
      </select>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Eating Window Start</label>
        <input type="time" class="form-input" id="inp-fast-start" value="${prof.eatingWindowStart || '12:00'}" />
      </div>
      <div class="form-group">
        <label class="form-label">Eating Window End</label>
        <input type="time" class="form-input" id="inp-fast-end" value="${prof.eatingWindowEnd || '20:00'}" />
      </div>
    </div>

    <button class="btn-primary" id="btn-save-fast-config" style="margin-top:6px;">Enable Fasting Window</button>
  `, (sheet) => {
    sheet.querySelector('#btn-save-fast-config')?.addEventListener('click', async () => {
      await saveProfile({
        fastingEnabled: true,
        fastingProtocol: sheet.querySelector('#inp-fast-proto').value,
        eatingWindowStart: sheet.querySelector('#inp-fast-start').value || '12:00',
        eatingWindowEnd: sheet.querySelector('#inp-fast-end').value || '20:00'
      });
      await refreshState();
      closeModal();
      renderApp();
      showToast('Fasting window enabled');
    });
  });
}

// --- Modal: Training Calories Burned ---
function openTrainingCaloriesModal() {
  const rec = state.dayRecord;
  const tdee = state.tdeeSummary;
  const currentTrainKcal = Math.max(0, Math.round(Number(rec.trainingCalories) || 0));
  const baseTarget = tdee.baseCalories || (tdee.calories - currentTrainKcal);

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Training Calories (${state.selectedDate})</div>
      <button class="icon-btn" data-close-modal>&times;</button>
    </div>

    <p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:12px;">
      Enter active workout / training calories burned today. These are automatically added to your daily calorie budget and macro tracking.
    </p>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Training Calories Burned (kcal)</label>
        <input type="number" min="0" max="10000" step="10" class="form-input" id="inp-training-kcal" value="${currentTrainKcal || ''}" placeholder="e.g. 450" />
      </div>
      <div class="form-group">
        <label class="form-label">New Daily Target (kcal)</label>
        <input type="number" class="form-input" id="inp-preview-total-kcal" value="${baseTarget + currentTrainKcal}" readonly style="opacity:0.85;" />
      </div>
    </div>

    <div style="display:flex;gap:8px;">
      <button class="btn-secondary" id="btn-clear-training-kcal" style="flex:1;">Reset (0 kcal)</button>
      <button class="btn-primary" id="btn-save-training-kcal" style="flex:2;">Save Training Calories</button>
    </div>
  `, (sheet) => {
    const trainInp = sheet.querySelector('#inp-training-kcal');
    const previewInp = sheet.querySelector('#inp-preview-total-kcal');

    trainInp.addEventListener('input', () => {
      const val = Math.max(0, Math.min(10000, Math.round(Number(trainInp.value) || 0)));
      previewInp.value = baseTarget + val;
    });

    sheet.querySelector('#btn-clear-training-kcal')?.addEventListener('click', async () => {
      await saveDailyRecord(state.selectedDate, { trainingCalories: 0, isTrainingDay: false });
      await refreshState();
      closeModal();
      renderApp();
      showToast('Training calories reset to 0');
    });

    sheet.querySelector('#btn-save-training-kcal')?.addEventListener('click', async () => {
      const kcal = Math.max(0, Math.min(10000, Math.round(Number(trainInp.value) || 0)));
      await saveDailyRecord(state.selectedDate, {
        trainingCalories: kcal,
        isTrainingDay: kcal > 0 ? true : rec.isTrainingDay
      });
      await refreshState();
      closeModal();
      renderApp();
      showToast(kcal > 0 ? `Added +${kcal} training kcal to daily target` : 'Training calories updated');
    });
  });
}

// --- Modal 1: Morning Weigh-In & 10-Metric Smart Scale Entry ---
function openWeighInModal(autoTriggerScan = false) {
  const rec = state.dayRecord;
  const prof = state.profile;
  const hasGeminiKey = Boolean(prof.geminiApiKey);
  let pendingScreenshots = [];

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Morning Weigh-In (${state.selectedDate})</div>
      <button class="icon-btn" data-close-modal>&times;</button>
    </div>

    <!-- Smart Scale Screenshot AI Scanner -->
    <div style="background:var(--bg-surface-elevated);border:1px solid rgba(16,185,129,0.35);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px;flex-wrap:wrap;">
        <span style="font-size:0.78rem;font-weight:700;color:var(--accent-emerald);">
          Import Weight Metrics from Screenshot(s)
        </span>
        <span class="badge-pill ${hasGeminiKey ? 'emerald' : 'amber'}" style="font-size:0.65rem;">
          ${hasGeminiKey ? 'Gemini Vision Ready' : 'Add Gemini Key in Settings'}
        </span>
      </div>
      <div style="font-size:0.73rem;color:var(--text-secondary);margin-bottom:8px;">
        Upload 1 or 2+ screenshots from your smart scale app to auto-fill all metrics below.
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <label class="btn-secondary" style="flex:1;text-align:center;cursor:pointer;font-size:0.76rem;border-color:rgba(16,185,129,0.45);color:var(--accent-emerald);">
          Select Scale Screenshot(s)
          <input type="file" id="inp-scale-screenshots" accept="image/*" multiple style="display:none;" />
        </label>
        <button class="btn-secondary" id="btn-run-scale-ocr" style="display:none;font-size:0.76rem;border-color:var(--accent-cyan);color:var(--accent-cyan);">
          Re-Scan
        </button>
      </div>
      <div id="scale-screenshots-preview" style="display:none;gap:6px;margin-top:8px;overflow-x:auto;"></div>
      <div id="scale-ocr-status" style="font-size:0.73rem;color:var(--text-secondary);margin-top:6px;display:none;"></div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button class="btn-secondary" id="btn-copy-prev-day" style="flex:1;font-size:0.76rem;">Copy Previous Entry</button>
      <button class="btn-secondary" id="btn-auto-estimate-comp" style="flex:1;font-size:0.76rem;border-color:rgba(0,229,255,0.4);color:var(--accent-cyan);">
        Auto-Estimate from Weight
      </button>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">1. Weight (kg) *</label>
        <input type="number" step="0.1" class="form-input" id="inp-weight" value="${rec.weight ?? ''}" placeholder="e.g. 78.4" />
      </div>
      <div class="form-group">
        <label class="form-label">2. BMI <span style="color:var(--accent-cyan);">AUTO</span></label>
        <input type="number" step="0.1" class="form-input" id="inp-bmi" value="${rec.bmi ?? ''}" readonly style="opacity:0.8;" />
      </div>

      <div class="form-group">
        <label class="form-label">3. Body Fat (%)</label>
        <input type="number" step="0.1" class="form-input" id="inp-bodyFat" value="${rec.bodyFat ?? ''}" placeholder="e.g. 15.2" />
      </div>
      <div class="form-group">
        <label class="form-label">4. Skeletal Muscle (kg)</label>
        <input type="number" step="0.1" class="form-input" id="inp-skeletalMuscle" value="${rec.skeletalMuscle ?? ''}" placeholder="e.g. 35.8" />
      </div>

      <div class="form-group">
        <label class="form-label">
          <span>5. Visceral Fat</span>
          <span style="color:var(--accent-cyan);font-size:0.66rem;">AUTO / EDIT</span>
        </label>
        <input type="number" step="0.5" class="form-input" id="inp-visceralFat" value="${rec.visceralFat ?? ''}" placeholder="Auto (1-30)" />
      </div>
      <div class="form-group">
        <label class="form-label">
          <span>6. BMR (kcal)</span>
          <span style="color:var(--accent-cyan);font-size:0.66rem;">AUTO / EDIT</span>
        </label>
        <input type="number" step="1" class="form-input" id="inp-bmr" value="${rec.bmr ?? ''}" placeholder="Auto kcal" />
      </div>

      <div class="form-group">
        <label class="form-label">7. Body Water (%)</label>
        <input type="number" step="0.1" class="form-input" id="inp-bodyWater" value="${rec.bodyWater ?? ''}" placeholder="e.g. 61.0" />
      </div>
      <div class="form-group">
        <label class="form-label">8. Bone Mineral Content (kg)</label>
        <input type="number" step="0.01" class="form-input" id="inp-boneMineral" value="${rec.boneMineral ?? ''}" placeholder="e.g. 3.25" />
      </div>

      <div class="form-group">
        <label class="form-label">9. Protein (%)</label>
        <input type="number" step="0.1" class="form-input" id="inp-proteinPct" value="${rec.proteinPct ?? ''}" placeholder="e.g. 18.4" />
      </div>
      <div class="form-group">
        <label class="form-label">10. Muscle Mass (kg)</label>
        <input type="number" step="0.1" class="form-input" id="inp-muscleMass" value="${rec.muscleMass ?? ''}" placeholder="e.g. 63.0" />
      </div>
    </div>

    <button class="btn-primary" id="btn-save-weighin" style="margin-top:8px;">Save Biometrics for ${state.selectedDate}</button>
  `, (sheet) => {
    const wInput = sheet.querySelector('#inp-weight');
    const bfInput = sheet.querySelector('#inp-bodyFat');
    const bmiInput = sheet.querySelector('#inp-bmi');
    const vfInput = sheet.querySelector('#inp-visceralFat');
    const bmrInput = sheet.querySelector('#inp-bmr');
    const screenshotInp = sheet.querySelector('#inp-scale-screenshots');
    const previewBox = sheet.querySelector('#scale-screenshots-preview');
    const ocrStatus = sheet.querySelector('#scale-ocr-status');
    const rescanBtn = sheet.querySelector('#btn-run-scale-ocr');

    let vfManuallyEdited = Boolean(rec.visceralFatManual);
    let bmrManuallyEdited = Boolean(rec.bmrManual);

    vfInput.addEventListener('input', () => { vfManuallyEdited = true; });
    bmrInput.addEventListener('input', () => { bmrManuallyEdited = true; });

    const triggerLiveAutoCalc = () => {
      const w = parseFloat(wInput.value);
      const bf = parseFloat(bfInput.value);
      if (!w) return;
      const computed = computeAutoMetrics({
        weight: w,
        bodyFat: isNaN(bf) ? null : bf,
        visceralFatManual: vfManuallyEdited,
        visceralFat: vfInput.value,
        bmrManual: bmrManuallyEdited,
        bmr: bmrInput.value
      }, prof);

      bmiInput.value = computed.bmi ?? '';
      if (!vfManuallyEdited) vfInput.value = computed.visceralFat ?? '';
      if (!bmrManuallyEdited) bmrInput.value = computed.bmr ?? '';
    };

    wInput.addEventListener('input', triggerLiveAutoCalc);
    bfInput.addEventListener('input', triggerLiveAutoCalc);

    const runScreenshotExtraction = async () => {
      if (!pendingScreenshots.length) return;
      ocrStatus.style.display = 'block';
      ocrStatus.style.color = 'var(--accent-cyan)';
      ocrStatus.textContent = `Extracting metrics from ${pendingScreenshots.length} screenshot(s)...`;
      rescanBtn.disabled = true;

      try {
        const extracted = await analyzeScaleScreenshotWithGemini({
          apiKey: prof.geminiApiKey,
          model: prof.geminiModel,
          imageDataUrls: pendingScreenshots
        });

        if (extracted.usedModel && extracted.usedModel !== prof.geminiModel) {
          await saveProfile({ geminiModel: extracted.usedModel });
          state.profile.geminiModel = extracted.usedModel;
        }

        let filledCount = 0;
        const fields = ['weight', 'bmi', 'bodyFat', 'skeletalMuscle', 'visceralFat', 'bmr', 'bodyWater', 'boneMineral', 'proteinPct', 'muscleMass'];
        fields.forEach(k => {
          if (extracted[k] != null) {
            const el = sheet.querySelector(`#inp-${k}`);
            if (el) {
              el.value = extracted[k];
              filledCount++;
            }
          }
        });

        if (extracted.visceralFat != null) vfManuallyEdited = true;
        if (extracted.bmr != null) bmrManuallyEdited = true;
        triggerLiveAutoCalc();

        ocrStatus.style.color = 'var(--accent-emerald)';
        ocrStatus.textContent = `Extracted ${filledCount} metric(s) from screenshot(s). Review & click Save below.`;
        showToast(`Extracted ${filledCount} metrics from screenshot`);
      } catch (err) {
        ocrStatus.style.color = 'var(--accent-danger)';
        ocrStatus.textContent = err.message;
        showToast(err.message);
      } finally {
        rescanBtn.disabled = false;
      }
    };

    screenshotInp?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      pendingScreenshots = await Promise.all(files.map(f => compressImageFile(f, 1200, 0.85)));
      previewBox.style.display = 'flex';
      previewBox.innerHTML = pendingScreenshots.map(src =>
        `<img src="${src}" style="height:68px;width:auto;border-radius:8px;border:1px solid var(--border-subtle);object-fit:cover;" />`
      ).join('');
      rescanBtn.style.display = 'inline-flex';
      await runScreenshotExtraction();
    });

    rescanBtn?.addEventListener('click', () => runScreenshotExtraction());

    if (autoTriggerScan) {
      setTimeout(() => screenshotInp?.click(), 120);
    }

    sheet.querySelector('#btn-copy-prev-day')?.addEventListener('click', () => {
      const prev = [...state.allRecords]
        .filter(r => r.date < state.selectedDate && r.weight != null)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!prev) {
        showToast('No previous weigh-in found');
        return;
      }
      ['weight', 'bmi', 'bodyFat', 'skeletalMuscle', 'visceralFat', 'bmr', 'bodyWater', 'boneMineral', 'proteinPct', 'muscleMass'].forEach(k => {
        const el = sheet.querySelector(`#inp-${k}`);
        if (el && prev[k] != null) el.value = prev[k];
      });
      showToast(`Copied values from ${prev.date}`);
    });

    sheet.querySelector('#btn-auto-estimate-comp')?.addEventListener('click', () => {
      const w = parseFloat(wInput.value);
      if (!w) {
        showToast('Enter your Weight (kg) first');
        return;
      }
      const bf = parseFloat(bfInput.value);
      const est = estimateSmartScaleComposition(w, isNaN(bf) ? null : bf, prof);
      Object.entries(est).forEach(([k, v]) => {
        const el = sheet.querySelector(`#inp-${k}`);
        if (el && v != null) el.value = v;
      });
      showToast('Smart composition estimated from Weight & Height');
    });

    sheet.querySelector('#btn-save-weighin')?.addEventListener('click', async () => {
      const readNum = (id) => {
        const v = sheet.querySelector(id)?.value;
        return v !== '' && v != null && !isNaN(Number(v)) ? Number(v) : null;
      };

      const payload = computeAutoMetrics({
        weight: readNum('#inp-weight'),
        bmi: readNum('#inp-bmi'),
        bodyFat: readNum('#inp-bodyFat'),
        skeletalMuscle: readNum('#inp-skeletalMuscle'),
        visceralFat: readNum('#inp-visceralFat'),
        visceralFatManual: vfManuallyEdited,
        bmr: readNum('#inp-bmr'),
        bmrManual: bmrManuallyEdited,
        bodyWater: readNum('#inp-bodyWater'),
        boneMineral: readNum('#inp-boneMineral'),
        proteinPct: readNum('#inp-proteinPct'),
        muscleMass: readNum('#inp-muscleMass')
      }, prof);

      await saveDailyRecord(state.selectedDate, payload);
      await refreshState();
      closeModal();
      renderApp();
      showToast('Morning weigh-in saved');
    });
  });
}

// --- Modal 2: Huawei Health / Garmin Single-Metric Drill-Down (W | M | Y) ---
function openMetricDrillModal(metricKey) {
  const def = METRIC_DEFINITIONS.find(m => m.key === metricKey) || METRIC_DEFINITIONS[0];
  let modalRange = 'W';

  const renderDrillContent = (sheet) => {
    const series = buildTimeSeries(state.allRecords, state.allMeals, state.selectedDate, modalRange);
    const stats = computeSeriesStats(series, def.key, def.decimals);
    const currentVal = state.dayRecord[def.key];
    const tag = getRangeTag(def, currentVal);

    const spectrumHtml = def.ranges ? `
      <div style="margin:10px 0 14px;">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-secondary);">
          <span>Status: <strong style="color:${tag.color};">${tag.text}</strong></span>
          <span>Current: <strong>${currentVal ?? '--'} ${def.unit}</strong></span>
        </div>
        <div class="spectrum-bar">
          ${def.ranges.map(r => `<div class="spectrum-seg" style="background:${r.color};" title="${r.label} (≤${r.max})"></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-muted);">
          ${def.ranges.map(r => `<span>${r.label}</span>`).join('')}
        </div>
      </div>
    ` : '';

    sheet.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">${def.label}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <div class="segmented-tabs">
            <button class="seg-btn ${modalRange === 'W' ? 'active' : ''}" data-drill-range="W">W</button>
            <button class="seg-btn ${modalRange === 'M' ? 'active' : ''}" data-drill-range="M">M</button>
            <button class="seg-btn ${modalRange === 'Y' ? 'active' : ''}" data-drill-range="Y">Y</button>
          </div>
          <button class="icon-btn" data-close-modal>&times;</button>
        </div>
      </div>

      <p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px;">${def.description}</p>
      ${spectrumHtml}

      <div class="chart-canvas-wrap">
        <canvas id="canvas-drill-metric"></canvas>
      </div>

      <div class="stats-strip-4" style="margin-bottom:14px;">
        <div class="stat-mini-card">
          <div class="s-lbl">Selected Day</div>
          <div class="s-val" style="color:${def.color};">${currentVal ?? '--'} <small>${def.unit}</small></div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">${modalRange} Avg</div>
          <div class="s-val">${stats.avg ?? '--'} <small>${def.unit}</small></div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">Low / High</div>
          <div class="s-val" style="font-size:0.78rem;">${stats.min != null ? `${stats.min}–${stats.max}` : '--'}</div>
        </div>
        <div class="stat-mini-card">
          <div class="s-lbl">Net Δ</div>
          <div class="s-val">${stats.delta != null ? (stats.delta > 0 ? '+' + stats.delta : stats.delta) : '--'}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;">
        <input type="number" step="any" class="form-input" id="inp-quick-metric-val" value="${currentVal ?? ''}" placeholder="Update ${def.label} for ${state.selectedDate}" style="flex:1;" />
        <button class="btn-primary" id="btn-quick-metric-save" style="width:auto;padding:0 18px;">Save</button>
      </div>
    `;

    sheet.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
    sheet.querySelectorAll('[data-drill-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        modalRange = btn.getAttribute('data-drill-range');
        renderDrillContent(sheet);
      });
    });

    sheet.querySelector('#btn-quick-metric-save')?.addEventListener('click', async () => {
      const val = sheet.querySelector('#inp-quick-metric-val').value;
      const numVal = val !== '' ? Number(val) : null;
      const partial = { [def.key]: numVal };
      if (def.key === 'visceralFat') partial.visceralFatManual = true;
      if (def.key === 'bmr') partial.bmrManual = true;
      const computed = computeAutoMetrics({ ...state.dayRecord, ...partial }, state.profile);
      await saveDailyRecord(state.selectedDate, computed);
      await refreshState();
      renderApp();
      renderDrillContent(sheet);
      showToast(`${def.label} updated`);
    });

    requestAnimationFrame(() => {
      renderMetricChart(sheet.querySelector('#canvas-drill-metric'), series, {
        primaryKey: def.key,
        primaryColor: def.color,
        showTrendLine: true,
        decimals: def.decimals
      });
    });
  };

  openModal('', (sheet) => renderDrillContent(sheet));
}

// --- Modal 3: 4-in-1 Meal Logger Modal (Gemini Vision/Text AI, Saved Meals, Search, Manual) ---
function openMealLoggerModal(initialTab = 'ai') {
  let activeMode = initialTab; // 'ai' | 'saved' | 'search' | 'manual'
  state.pendingAiImage = null;
  state.pendingAiResult = null;

  const slotOptions = state.profile.mealSlots.map(s => `<option value="${s}">${s}</option>`).join('');
  const nowTime = new Date().toTimeString().slice(0, 5);

  const renderModalBody = (sheet) => {
    sheet.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Log Meal (${state.selectedDate})</div>
        <button class="icon-btn" data-close-modal>&times;</button>
      </div>

      <!-- Mode Switcher -->
      <div class="segmented-tabs" style="width:100%;display:grid;grid-template-columns:repeat(4,1fr);margin-bottom:12px;text-align:center;">
        <button class="seg-btn ${activeMode === 'ai' ? 'active' : ''}" data-meal-mode="ai">AI Vision</button>
        <button class="seg-btn ${activeMode === 'saved' ? 'active' : ''}" data-meal-mode="saved">Saved</button>
        <button class="seg-btn ${activeMode === 'search' ? 'active' : ''}" data-meal-mode="search">Search</button>
        <button class="seg-btn ${activeMode === 'manual' ? 'active' : ''}" data-meal-mode="manual">Manual</button>
      </div>

      <!-- Shared Slot & Time Picker -->
      <div class="form-grid-2" style="margin-bottom:10px;">
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Meal Slot</label>
          <select class="form-select" id="meal-slot-select">${slotOptions}</select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label">Time</label>
          <input type="time" class="form-input" id="meal-time-input" value="${nowTime}" />
        </div>
      </div>

      <div id="meal-mode-content"></div>
    `;

    sheet.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
    sheet.querySelectorAll('[data-meal-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeMode = btn.getAttribute('data-meal-mode');
        renderModalBody(sheet);
      });
    });

    const contentBox = sheet.querySelector('#meal-mode-content');
    const getSlotAndTime = () => ({
      mealSlot: sheet.querySelector('#meal-slot-select')?.value || 'Lunch',
      timestamp: sheet.querySelector('#meal-time-input')?.value || nowTime
    });

    if (activeMode === 'ai') {
      renderAiMealTab(contentBox, getSlotAndTime);
    } else if (activeMode === 'saved') {
      renderSavedMealTab(contentBox, getSlotAndTime);
    } else if (activeMode === 'search') {
      renderSearchFoodTab(contentBox, getSlotAndTime);
    } else {
      renderManualMacroTab(contentBox, getSlotAndTime);
    }
  };

  openModal('', (sheet) => renderModalBody(sheet));
}

function renderAiMealTab(box, getSlotAndTime) {
  const hasKey = Boolean(state.profile.geminiApiKey);
  box.innerHTML = `
    <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:0.8rem;font-weight:700;color:var(--accent-cyan);">
          Gemini Vision Image + Text Analyzer
        </span>
        <span class="badge-pill ${hasKey ? 'emerald' : 'amber'}">${hasKey ? 'Gemini Ready' : 'Offline Fallback / Add Key in Settings'}</span>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <label class="btn-secondary" style="flex:1;text-align:center;cursor:pointer;">
          Snap / Upload Meal Photo
          <input type="file" id="inp-ai-meal-photo" accept="image/*" style="display:none;" />
        </label>
      </div>

      <div id="ai-photo-preview-wrap" style="${state.pendingAiImage ? '' : 'display:none;'}margin-bottom:10px;">
        <img id="ai-photo-preview" src="${state.pendingAiImage || ''}" style="width:100%;max-height:170px;object-fit:cover;border-radius:10px;" />
      </div>

      <div class="form-group">
        <label class="form-label">Meal Description / Ingredients (Optional with photo, or type to parse)</label>
        <textarea class="form-textarea" id="inp-ai-meal-text" rows="2" placeholder="e.g. 200g chicken breast, 150g cooked white rice, 1 tbsp olive oil"></textarea>
      </div>

      <button class="btn-primary" id="btn-run-ai-analyze">Calculate Macros with AI</button>
    </div>

    <div id="ai-result-editor"></div>
  `;

  const fileInp = box.querySelector('#inp-ai-meal-photo');
  const previewWrap = box.querySelector('#ai-photo-preview-wrap');
  const previewImg = box.querySelector('#ai-photo-preview');

  fileInp?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.pendingAiImage = await compressImageFile(file, 900, 0.82);
    previewImg.src = state.pendingAiImage;
    previewWrap.style.display = 'block';
  });

  box.querySelector('#btn-run-ai-analyze')?.addEventListener('click', async () => {
    const btn = box.querySelector('#btn-run-ai-analyze');
    const textPrompt = box.querySelector('#inp-ai-meal-text').value;
    btn.textContent = 'Analyzing Meal Macros...';
    btn.disabled = true;

    try {
      const result = await analyzeMealWithGemini({
        apiKey: state.profile.geminiApiKey,
        model: state.profile.geminiModel,
        textPrompt,
        imageDataUrl: state.pendingAiImage,
        savedItems: state.savedItems
      });
      if (result.usedModel && result.usedModel !== state.profile.geminiModel) {
        await saveProfile({ geminiModel: result.usedModel });
        state.profile.geminiModel = result.usedModel;
      }
      state.pendingAiResult = result;
      renderAiResultConfirmation(box.querySelector('#ai-result-editor'), result, getSlotAndTime);
    } catch (err) {
      showToast(err.message);
    } finally {
      btn.textContent = 'Calculate Macros with AI';
      btn.disabled = false;
    }
  });
}

function renderAiResultConfirmation(targetEl, result, getSlotAndTime) {
  targetEl.innerHTML = `
    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.35);border-radius:var(--radius-sm);padding:12px;">
      <div class="form-group">
        <label class="form-label">Detected Meal Name</label>
        <input type="text" class="form-input" id="ai-res-name" value="${result.mealName}" />
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Calories (kcal)</label>
          <input type="number" class="form-input" id="ai-res-kcal" value="${result.calories}" />
        </div>
        <div class="form-group">
          <label class="form-label">Protein (g)</label>
          <input type="number" step="0.1" class="form-input" id="ai-res-p" value="${result.protein}" />
        </div>
        <div class="form-group">
          <label class="form-label">Carbs (g)</label>
          <input type="number" step="0.1" class="form-input" id="ai-res-c" value="${result.carbs}" />
        </div>
        <div class="form-group">
          <label class="form-label">Fat (g)</label>
          <input type="number" step="0.1" class="form-input" id="ai-res-f" value="${result.fat}" />
        </div>
      </div>

      <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-secondary);margin-bottom:10px;cursor:pointer;">
        <input type="checkbox" id="ai-save-reusable" />
        <span>Also save this to Saved Meals for future 1-tap reuse</span>
      </label>

      <button class="btn-primary" id="btn-confirm-ai-meal">Log Meal to ${state.selectedDate}</button>
    </div>
  `;

  targetEl.querySelector('#btn-confirm-ai-meal')?.addEventListener('click', async () => {
    const { mealSlot, timestamp } = getSlotAndTime();
    const name = targetEl.querySelector('#ai-res-name').value || 'AI Meal';
    const calories = Number(targetEl.querySelector('#ai-res-kcal').value) || 0;
    const protein = Number(targetEl.querySelector('#ai-res-p').value) || 0;
    const carbs = Number(targetEl.querySelector('#ai-res-c').value) || 0;
    const fat = Number(targetEl.querySelector('#ai-res-f').value) || 0;

    if (targetEl.querySelector('#ai-save-reusable')?.checked) {
      await saveCustomItem({
        itemType: 'meal',
        name,
        calories,
        protein,
        carbs,
        fat
      });
    }

    await addMealLog({
      date: state.selectedDate,
      mealSlot,
      timestamp,
      name,
      calories,
      protein,
      carbs,
      fat,
      source: result.source || 'ai_vision'
    });

    await refreshState();
    closeModal();
    renderApp();
    showToast(`Logged ${name} (${calories} kcal)`);
  });
}

function renderSavedMealTab(box, getSlotAndTime) {
  const meals = state.savedItems.filter(i => i.itemType === 'meal');
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <span style="font-size:0.8rem;color:var(--text-secondary);">Tap a saved meal to log it, or create a new reusable meal:</span>
      <button class="icon-btn" id="btn-modal-create-saved" style="color:var(--accent-cyan);border-color:var(--accent-cyan);">+ Create Meal</button>
    </div>
    ${meals.length === 0 ? `
      <div style="text-align:center;padding:18px;color:var(--text-muted);font-size:0.82rem;">
        No saved meals yet. Click "+ Create Meal" to build a reusable meal (supports AI macro calculation or manual input).
      </div>
    ` : meals.map(m => `
      <div class="meal-item-row">
        <div class="meal-item-info">
          <div class="meal-item-title">${m.name}</div>
          <div class="meal-item-meta">P: ${m.protein}g • C: ${m.carbs}g • F: ${m.fat}g</div>
        </div>
        <div class="meal-item-right">
          <span class="meal-item-kcal">${m.calories} kcal</span>
          <button class="btn-secondary" data-log-saved-now="${m.id}" style="padding:5px 10px;font-size:0.76rem;border-color:var(--accent-cyan);color:var(--accent-cyan);">+ Log</button>
        </div>
      </div>
    `).join('')}
  `;

  box.querySelector('#btn-modal-create-saved')?.addEventListener('click', () => openCreateSavedItemModal('meal'));
  box.querySelectorAll('[data-log-saved-now]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = meals.find(x => x.id === btn.getAttribute('data-log-saved-now'));
      if (!m) return;
      const { mealSlot, timestamp } = getSlotAndTime();
      await addMealLog({
        date: state.selectedDate,
        mealSlot,
        timestamp,
        name: m.name,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        source: 'saved_meal'
      });
      await refreshState();
      closeModal();
      renderApp();
      showToast(`Logged "${m.name}"`);
    });
  });
}

function renderSearchFoodTab(box, getSlotAndTime) {
  box.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:10px;">
      <input type="text" class="form-input" id="inp-food-search" placeholder="Search snacks, chicken, oats, yogurt, whey..." style="flex:1;" />
      <button class="btn-secondary" id="btn-search-online">USDA</button>
    </div>
    <div id="food-search-results" style="max-height:280px;overflow-y:auto;"></div>
  `;

  const resultsBox = box.querySelector('#food-search-results');
  const searchInp = box.querySelector('#inp-food-search');

  const runSearch = async (online = false) => {
    const items = await searchFoodCatalog(searchInp.value, state.savedItems, state.profile.usdaApiKey, online);
    resultsBox.innerHTML = items.slice(0, 25).map((item, idx) => `
      <div class="meal-item-row" style="flex-wrap:wrap;gap:6px;">
        <div class="meal-item-info">
          <div class="meal-item-title">${item.name} <span class="badge-pill" style="font-size:0.62rem;">${item.sourceBadge || 'Food'}</span></div>
          <div class="meal-item-meta">
            Per ${item.servingSize}${item.servingUnit}: ${item.calories} kcal • P ${item.protein}g • C ${item.carbs}g • F ${item.fat}g
          </div>
        </div>
        <div class="meal-item-right">
          <input type="number" step="any" class="form-input" data-qty-idx="${idx}" value="${item.servingSize}" style="width:68px;padding:4px 6px;font-size:0.78rem;" />
          <span style="font-size:0.72rem;color:var(--text-secondary);">${item.servingUnit}</span>
          <button class="btn-secondary" data-add-search-idx="${idx}" style="padding:5px 10px;font-size:0.75rem;border-color:var(--accent-cyan);color:var(--accent-cyan);">Add</button>
        </div>
      </div>
    `).join('');

    resultsBox.querySelectorAll('[data-add-search-idx]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-add-search-idx'));
        const food = items[idx];
        const qtyInput = resultsBox.querySelector(`[data-qty-idx="${idx}"]`);
        const enteredQty = Number(qtyInput?.value) || food.servingSize;
        const ratio = enteredQty / (Number(food.servingSize) || 100);
        const { mealSlot, timestamp } = getSlotAndTime();

        await addMealLog({
          date: state.selectedDate,
          mealSlot,
          timestamp,
          name: `${food.name} (${enteredQty}${food.servingUnit})`,
          amount: enteredQty,
          unit: food.servingUnit,
          calories: Math.round(food.calories * ratio),
          protein: Math.round(food.protein * ratio * 10) / 10,
          carbs: Math.round(food.carbs * ratio * 10) / 10,
          fat: Math.round(food.fat * ratio * 10) / 10,
          source: 'food_db'
        });

        await refreshState();
        closeModal();
        renderApp();
        showToast(`Added ${food.name}`);
      });
    });
  };

  searchInp.addEventListener('input', () => runSearch(false));
  box.querySelector('#btn-search-online')?.addEventListener('click', () => runSearch(true));
  runSearch(false);
}

function renderManualMacroTab(box, getSlotAndTime) {
  box.innerHTML = `
    <div class="form-group">
      <label class="form-label">Meal / Snack Title</label>
      <input type="text" class="form-input" id="man-meal-name" placeholder="e.g. Post-Workout Shake or Homemade Bowl" />
    </div>
    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Calories (kcal) <span style="color:var(--accent-cyan);">Auto or Edit</span></label>
        <input type="number" class="form-input" id="man-meal-kcal" placeholder="e.g. 550" />
      </div>
      <div class="form-group">
        <label class="form-label">Protein (g)</label>
        <input type="number" step="0.1" class="form-input" id="man-meal-p" placeholder="e.g. 45" />
      </div>
      <div class="form-group">
        <label class="form-label">Carbs (g)</label>
        <input type="number" step="0.1" class="form-input" id="man-meal-c" placeholder="e.g. 55" />
      </div>
      <div class="form-group">
        <label class="form-label">Fat (g)</label>
        <input type="number" step="0.1" class="form-input" id="man-meal-f" placeholder="e.g. 15" />
      </div>
    </div>

    <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-secondary);margin-bottom:12px;cursor:pointer;">
      <input type="checkbox" id="man-save-reusable" />
      <span>Save to Saved Meals for future reuse</span>
    </label>

    <button class="btn-primary" id="btn-save-manual-meal">Log Manual Meal</button>
  `;

  const kcalEl = box.querySelector('#man-meal-kcal');
  const pEl = box.querySelector('#man-meal-p');
  const cEl = box.querySelector('#man-meal-c');
  const fEl = box.querySelector('#man-meal-f');
  let kcalTouched = false;
  kcalEl.addEventListener('input', () => { kcalTouched = true; });

  const autoKcalFromMacros = () => {
    if (kcalTouched) return;
    const p = Number(pEl.value) || 0;
    const c = Number(cEl.value) || 0;
    const f = Number(fEl.value) || 0;
    if (p || c || f) kcalEl.value = Math.round(p * 4 + c * 4 + f * 9);
  };
  [pEl, cEl, fEl].forEach(el => el.addEventListener('input', autoKcalFromMacros));

  box.querySelector('#btn-save-manual-meal')?.addEventListener('click', async () => {
    const { mealSlot, timestamp } = getSlotAndTime();
    const name = box.querySelector('#man-meal-name').value.trim() || 'Quick Macro Entry';
    const calories = Number(kcalEl.value) || 0;
    const protein = Number(pEl.value) || 0;
    const carbs = Number(cEl.value) || 0;
    const fat = Number(fEl.value) || 0;

    if (box.querySelector('#man-save-reusable')?.checked) {
      await saveCustomItem({ itemType: 'meal', name, calories, protein, carbs, fat });
    }

    await addMealLog({
      date: state.selectedDate,
      mealSlot,
      timestamp,
      name,
      calories,
      protein,
      carbs,
      fat,
      source: 'manual'
    });

    await refreshState();
    closeModal();
    renderApp();
    showToast(`Logged ${name}`);
  });
}

// --- Modal 4: Create Reusable Saved Meal / Registered Snack (with AI Auto-Calculate) ---
function openCreateSavedItemModal(itemType = 'meal') {
  let uploadedImg = null;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${itemType === 'meal' ? 'Create Reusable Meal' : 'Register Custom Food / Snack'}</div>
      <button class="icon-btn" data-close-modal>&times;</button>
    </div>

    <div class="form-group">
      <label class="form-label">${itemType === 'meal' ? 'Meal Name' : 'Food / Snack Name'} *</label>
      <input type="text" class="form-input" id="custom-item-name" placeholder="${itemType === 'meal' ? 'e.g. Morning Protein Oats Bowl' : 'e.g. Protein Pudding Cup'}" />
    </div>

    <!-- AI Auto-Calculate Box for Saved Meals -->
    <div style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:10px;margin-bottom:12px;">
      <div style="font-size:0.76rem;font-weight:700;color:var(--accent-cyan);margin-bottom:6px;">
        Auto-Calculate Macros (via Gemini AI or Offline Ingredients)
      </div>
      <textarea class="form-textarea" id="custom-item-ingr" rows="2" placeholder="Type ingredients (e.g. 80g oats, 1 scoop whey, 1 banana, 15g peanut butter) or upload photo below" style="width:100%;margin-bottom:8px;"></textarea>
      <div style="display:flex;gap:8px;">
        <label class="btn-secondary" style="flex:1;text-align:center;cursor:pointer;font-size:0.75rem;">
          Attach Photo
          <input type="file" id="custom-item-photo" accept="image/*" style="display:none;" />
        </label>
        <button class="btn-secondary" id="btn-custom-ai-calc" style="flex:2;border-color:var(--accent-cyan);color:var(--accent-cyan);font-size:0.75rem;">
          Auto-Calculate Macros
        </button>
      </div>
    </div>

    ${itemType === 'food' ? `
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Serving Size</label>
          <input type="number" class="form-input" id="custom-serving-size" value="100" />
        </div>
        <div class="form-group">
          <label class="form-label">Serving Unit</label>
          <input type="text" class="form-input" id="custom-serving-unit" value="g" />
        </div>
      </div>
    ` : ''}

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Calories (kcal)</label>
        <input type="number" class="form-input" id="custom-kcal" placeholder="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Protein (g)</label>
        <input type="number" step="0.1" class="form-input" id="custom-p" placeholder="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Carbs (g)</label>
        <input type="number" step="0.1" class="form-input" id="custom-c" placeholder="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Fat (g)</label>
        <input type="number" step="0.1" class="form-input" id="custom-f" placeholder="0" />
      </div>
    </div>

    <button class="btn-primary" id="btn-save-custom-item">Save to Library</button>
  `, (sheet) => {
    sheet.querySelector('#custom-item-photo')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (f) {
        uploadedImg = await compressImageFile(f, 800, 0.8);
        showToast('Photo attached — click Auto-Calculate Macros');
      }
    });

    sheet.querySelector('#btn-custom-ai-calc')?.addEventListener('click', async () => {
      const btn = sheet.querySelector('#btn-custom-ai-calc');
      const ingr = sheet.querySelector('#custom-item-ingr').value;
      btn.textContent = 'Calculating...';
      try {
        const res = await analyzeMealWithGemini({
          apiKey: state.profile.geminiApiKey,
          model: state.profile.geminiModel,
          textPrompt: ingr,
          imageDataUrl: uploadedImg,
          savedItems: state.savedItems
        });
        if (!sheet.querySelector('#custom-item-name').value) {
          sheet.querySelector('#custom-item-name').value = res.mealName;
        }
        sheet.querySelector('#custom-kcal').value = res.calories;
        sheet.querySelector('#custom-p').value = res.protein;
        sheet.querySelector('#custom-c').value = res.carbs;
        sheet.querySelector('#custom-f').value = res.fat;
        showToast('Macros auto-calculated');
      } catch (err) {
        showToast(err.message);
      } finally {
        btn.textContent = 'Auto-Calculate Macros';
      }
    });

    sheet.querySelector('#btn-save-custom-item')?.addEventListener('click', async () => {
      const name = sheet.querySelector('#custom-item-name').value.trim();
      if (!name) {
        showToast('Please enter a name');
        return;
      }
      await saveCustomItem({
        itemType,
        name,
        servingSize: sheet.querySelector('#custom-serving-size')?.value || 1,
        servingUnit: sheet.querySelector('#custom-serving-unit')?.value || 'serving',
        calories: Number(sheet.querySelector('#custom-kcal').value) || 0,
        protein: Number(sheet.querySelector('#custom-p').value) || 0,
        carbs: Number(sheet.querySelector('#custom-c').value) || 0,
        fat: Number(sheet.querySelector('#custom-f').value) || 0,
        ingredientsText: sheet.querySelector('#custom-item-ingr').value.trim()
      });
      await refreshState();
      closeModal();
      renderApp();
      showToast(`Saved "${name}" to library`);
    });
  });
}

// --- Modal 5: Sleep & Readiness Biofeedback ---
function openReadinessModal() {
  const rec = state.dayRecord;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Sleep & Readiness (${state.selectedDate})</div>
      <button class="icon-btn" data-close-modal>&times;</button>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Sleep Duration (0–24h)</label>
        <input type="number" min="0" max="24" step="0.25" class="form-input" id="inp-sleep-hrs" value="${rec.sleepHours ?? ''}" placeholder="e.g. 7.5" />
      </div>
      <div class="form-group">
        <label class="form-label">Sleep Score (1–100)</label>
        <input type="number" min="1" max="100" step="1" class="form-input" id="inp-sleep-score" value="${rec.sleepQuality ?? ''}" placeholder="1 to 100" />
      </div>
      <div class="form-group">
        <label class="form-label">Energy / Readiness (1–5)</label>
        <input type="number" min="1" max="5" step="1" class="form-input" id="inp-energy" value="${rec.energy ?? ''}" placeholder="1 to 5" />
      </div>
      <div class="form-group">
        <label class="form-label">Muscle Soreness (1–5)</label>
        <input type="number" min="1" max="5" step="1" class="form-input" id="inp-soreness" value="${rec.soreness ?? ''}" placeholder="1 to 5" />
      </div>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Daily Step Count</label>
        <input type="number" min="0" max="200000" step="1" class="form-input" id="inp-steps" value="${rec.steps ?? ''}" placeholder="e.g. 9500" />
      </div>
      <div class="form-group">
        <label class="form-label">Training Calories (kcal)</label>
        <input type="number" min="0" max="10000" step="10" class="form-input" id="inp-readiness-train-kcal" value="${rec.trainingCalories || ''}" placeholder="e.g. 450" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Daily Notes / Workout Reflection</label>
      <textarea class="form-textarea" id="inp-day-notes" rows="2" placeholder="Optional notes...">${rec.notes || ''}</textarea>
    </div>

    <button class="btn-primary" id="btn-save-readiness">Save Sleep & Readiness</button>
  `, (sheet) => {
    const bindClamp = (selector, min, max, isInt = false) => {
      const el = sheet.querySelector(selector);
      if (!el) return;
      el.addEventListener('change', () => {
        if (el.value === '') return;
        let n = Number(el.value);
        if (isNaN(n)) {
          el.value = '';
          return;
        }
        if (isInt) n = Math.round(n);
        el.value = Math.max(min, Math.min(max, n));
      });
    };

    bindClamp('#inp-sleep-hrs', 0, 24, false);
    bindClamp('#inp-sleep-score', 1, 100, true);
    bindClamp('#inp-energy', 1, 5, true);
    bindClamp('#inp-soreness', 1, 5, true);
    bindClamp('#inp-steps', 0, 200000, true);
    bindClamp('#inp-readiness-train-kcal', 0, 10000, true);

    sheet.querySelector('#btn-save-readiness')?.addEventListener('click', async () => {
      const readClamped = (id, min, max, isInt = false) => {
        const v = sheet.querySelector(id)?.value;
        if (v === '' || v == null || isNaN(Number(v))) return null;
        let n = Number(v);
        if (isInt) n = Math.round(n);
        return Math.max(min, Math.min(max, n));
      };
      const trainKcal = readClamped('#inp-readiness-train-kcal', 0, 10000, true) || 0;
      await saveDailyRecord(state.selectedDate, {
        sleepHours: readClamped('#inp-sleep-hrs', 0, 24, false),
        sleepQuality: readClamped('#inp-sleep-score', 1, 100, true),
        energy: readClamped('#inp-energy', 1, 5, true),
        soreness: readClamped('#inp-soreness', 1, 5, true),
        steps: readClamped('#inp-steps', 0, 200000, true),
        trainingCalories: trainKcal,
        isTrainingDay: trainKcal > 0 ? true : rec.isTrainingDay,
        notes: sheet.querySelector('#inp-day-notes').value.trim()
      });
      await refreshState();
      closeModal();
      renderApp();
      showToast('Sleep & readiness updated');
    });
  });
}

// --- Modal 6: Progress Photo Upload ---
function openPhotoUploadModal() {
  let compressedDataUrl = null;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Add Progress Photo (${state.selectedDate})</div>
      <button class="icon-btn" data-close-modal>&times;</button>
    </div>

    <label class="btn-secondary" style="display:block;text-align:center;cursor:pointer;margin-bottom:12px;">
      Select or Take Photo
      <input type="file" id="inp-prog-photo" accept="image/*" style="display:none;" />
    </label>

    <div id="prog-photo-preview-box" style="display:none;margin-bottom:12px;">
      <img id="prog-photo-img" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;" />
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Pose</label>
        <select class="form-select" id="inp-photo-pose">
          <option value="Front">Front</option>
          <option value="Side">Side</option>
          <option value="Back">Back</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">State</label>
        <select class="form-select" id="inp-photo-state">
          <option value="Relaxed">Relaxed</option>
          <option value="Flexed">Flexed</option>
        </select>
      </div>
    </div>

    <button class="btn-primary" id="btn-save-prog-photo">Save Photo to ${state.selectedDate}</button>
  `, (sheet) => {
    sheet.querySelector('#inp-prog-photo')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      compressedDataUrl = await compressImageFile(f, 950, 0.82);
      sheet.querySelector('#prog-photo-img').src = compressedDataUrl;
      sheet.querySelector('#prog-photo-preview-box').style.display = 'block';
    });

    sheet.querySelector('#btn-save-prog-photo')?.addEventListener('click', async () => {
      if (!compressedDataUrl) {
        showToast('Please select a photo first');
        return;
      }
      await saveProgressPhoto({
        date: state.selectedDate,
        pose: sheet.querySelector('#inp-photo-pose').value,
        state: sheet.querySelector('#inp-photo-state').value,
        dataUrl: compressedDataUrl,
        weight: state.dayRecord.weight,
        bodyFat: state.dayRecord.bodyFat
      });
      await refreshState();
      closeModal();
      renderApp();
      showToast('Progress photo saved');
    });
  });
}

// ============================================================================
// Main App Render & Navigation Controller
// ============================================================================
function renderApp() {
  renderCalendarBar();
  const mainContainer = document.getElementById('main-view-container');
  if (!mainContainer) return;

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === state.activeTab);
  });

  if (state.activeTab === 'day') {
    renderMyDayView(mainContainer);
  } else if (state.activeTab === 'trends') {
    renderTrendsView(mainContainer);
  } else if (state.activeTab === 'library') {
    renderLibraryView(mainContainer);
  } else if (state.activeTab === 'settings') {
    renderSettingsView(mainContainer);
  }
}

async function initApp() {
  await refreshState();
  renderApp();

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.getAttribute('data-tab');
      renderApp();
    });
  });

  document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
}

window.addEventListener('DOMContentLoaded', initApp);
