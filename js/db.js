/**
 * IndexedDB Storage Layer for HAPP (Health & Fitness Tracker)
 * Stores all daily biometrics, meals, saved meals/foods, progress photos, and profile settings.
 */

const DB_NAME = 'happ_fitness_db';
const DB_VERSION = 1;

export const DEFAULT_PROFILE = {
  id: 'user_profile',
  name: 'Athlete',
  sex: 'male',
  age: 28,
  heightCm: 178,
  goalType: 'cut', // 'cut' | 'maintain' | 'bulk'
  weeklyRateKg: -0.5, // target kg change per week
  proteinPerKg: 2.0, // g/kg of body weight
  proteinBasis: 'total', // 'total' | 'lean'
  fatSharePct: 30, // % of non-protein calories or total calories
  carbCyclingEnabled: true,
  trainingDayCalorieBoost: 200, // +kcal on training days, balanced on rest days
  manualOverrideEnabled: false,
  manualCalories: 2300,
  manualProtein: 175,
  manualCarbs: 230,
  manualFat: 75,
  manualBmrOverride: null, // null = auto-calculate
  hydrationGoalCups: 10, // 10 x 250ml = 2500ml
  cupSizeMl: 250,
  fastingEnabled: false,
  fastingProtocol: '16:8', // '16:8' | '18:6' | '20:4' | '14:10'
  eatingWindowStart: '12:00',
  eatingWindowEnd: '20:00',
  mealSlots: ['Breakfast', 'Lunch', 'Pre-Workout', 'Post-Workout', 'Dinner', 'Snacks'],
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-pro-preview',
  usdaApiKey: 'DEMO_KEY'
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Profile & Settings
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }

      // 2. Daily Records (keyed by YYYY-MM-DD date string)
      // Contains: weight, bmi, bodyFat, skeletalMuscle, visceralFat, bmr, bmrManual,
      // bodyWater, boneMineral, proteinPct, muscleMass, cups, sleepHours, sleepQuality,
      // energy, soreness, steps, isTrainingDay, fastingStart, fastingEnd, notes
      if (!db.objectStoreNames.contains('daily_records')) {
        db.createObjectStore('daily_records', { keyPath: 'date' });
      }

      // 3. Meal Logs (keyed by id, indexed by date)
      if (!db.objectStoreNames.contains('meal_logs')) {
        const mealStore = db.createObjectStore('meal_logs', { keyPath: 'id' });
        mealStore.createIndex('by_date', 'date', { unique: false });
      }

      // 4. Saved Meals & Registered Foods/Snacks (keyed by id)
      if (!db.objectStoreNames.contains('saved_items')) {
        const itemStore = db.createObjectStore('saved_items', { keyPath: 'id' });
        itemStore.createIndex('by_type', 'itemType', { unique: false }); // 'meal' | 'food'
      }

      // 5. Progress Photos (keyed by id, indexed by date)
      if (!db.objectStoreNames.contains('progress_photos')) {
        const photoStore = db.createObjectStore('progress_photos', { keyPath: 'id' });
        photoStore.createIndex('by_date', 'date', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
  return dbPromise;
}

async function txGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function txPut(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

async function txDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function txGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function txGetByIndex(storeName, indexName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const idx = tx.objectStore(storeName).index(indexName);
    const req = idx.getAll(key);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// --- Profile API ---
export async function getProfile() {
  const existing = await txGet('profile', 'user_profile');
  if (!existing) {
    await txPut('profile', DEFAULT_PROFILE);
    return { ...DEFAULT_PROFILE };
  }
  if (existing.geminiModel === 'gemini-2.5-pro' || existing.geminiModel === 'gemini-2.0-flash') {
    existing.geminiModel = 'gemini-3.1-pro-preview';
    await txPut('profile', { ...DEFAULT_PROFILE, ...existing, id: 'user_profile' });
  }
  return { ...DEFAULT_PROFILE, ...existing };
}

export async function saveProfile(updates) {
  const current = await getProfile();
  const updated = { ...current, ...updates, id: 'user_profile' };
  await txPut('profile', updated);
  return updated;
}

// --- Daily Records API ---
export function createEmptyDailyRecord(date) {
  return {
    date,
    weight: null,
    bmi: null,
    bodyFat: null,
    skeletalMuscle: null,
    visceralFat: null,
    visceralFatManual: false,
    bmr: null,
    bmrManual: false,
    bodyWater: null,
    boneMineral: null,
    proteinPct: null,
    muscleMass: null,
    cups: 0,
    sleepHours: null,
    sleepQuality: null, // 1-100 score or 1-5
    energy: null, // 1-5
    soreness: null, // 1-5
    steps: null,
    isTrainingDay: false,
    trainingCalories: 0,
    fastingStartedAt: null,
    notes: '',
    updatedAt: Date.now()
  };
}

export async function getDailyRecord(date) {
  const record = await txGet('daily_records', date);
  return record ? { ...createEmptyDailyRecord(date), ...record } : createEmptyDailyRecord(date);
}

export async function saveDailyRecord(date, partial) {
  const current = await getDailyRecord(date);
  const updated = {
    ...current,
    ...partial,
    date,
    updatedAt: Date.now()
  };
  await txPut('daily_records', updated);
  return updated;
}

export async function getAllDailyRecords() {
  const records = await txGetAll('daily_records');
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

// --- Meal Logs API ---
export async function getMealsByDate(date) {
  const meals = await txGetByIndex('meal_logs', 'by_date', date);
  return meals.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
}

export async function getAllMealLogs() {
  return await txGetAll('meal_logs');
}

export async function addMealLog(meal) {
  const entry = {
    id: meal.id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: meal.date,
    timestamp: meal.timestamp || new Date().toTimeString().slice(0, 5),
    mealSlot: meal.mealSlot || 'Lunch',
    name: meal.name || 'Logged Meal',
    amount: Number(meal.amount) || 1,
    unit: meal.unit || 'serving',
    calories: Math.round(Number(meal.calories) || 0),
    protein: Math.round((Number(meal.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(meal.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(meal.fat) || 0) * 10) / 10,
    source: meal.source || 'manual', // 'ai_vision' | 'ai_text' | 'saved_meal' | 'food_db' | 'manual'
    items: meal.items || [],
    createdAt: Date.now()
  };
  await txPut('meal_logs', entry);
  return entry;
}

export async function deleteMealLog(id) {
  return await txDelete('meal_logs', id);
}

// --- Saved Meals & Registered Foods API ---
export async function getSavedItems() {
  const items = await txGetAll('saved_items');
  return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function saveCustomItem(item) {
  const entry = {
    id: item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    itemType: item.itemType || 'meal', // 'meal' | 'food'
    name: item.name,
    brand: item.brand || '',
    servingSize: Number(item.servingSize) || 100,
    servingUnit: item.servingUnit || (item.itemType === 'meal' ? 'serving' : 'g'),
    calories: Math.round(Number(item.calories) || 0),
    protein: Math.round((Number(item.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(item.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(item.fat) || 0) * 10) / 10,
    ingredientsText: item.ingredientsText || '',
    updatedAt: Date.now()
  };
  await txPut('saved_items', entry);
  return entry;
}

export async function deleteSavedItem(id) {
  return await txDelete('saved_items', id);
}

// --- Progress Photos API ---
export async function getPhotosByDate(date) {
  return await txGetByIndex('progress_photos', 'by_date', date);
}

export async function getAllPhotos() {
  const photos = await txGetAll('progress_photos');
  return photos.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

export async function saveProgressPhoto(photo) {
  const entry = {
    id: photo.id || `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: photo.date,
    pose: photo.pose || 'Front', // 'Front' | 'Side' | 'Back'
    state: photo.state || 'Relaxed', // 'Relaxed' | 'Flexed'
    dataUrl: photo.dataUrl,
    weight: photo.weight || null,
    bodyFat: photo.bodyFat || null,
    notes: photo.notes || '',
    createdAt: Date.now()
  };
  await txPut('progress_photos', entry);
  return entry;
}

export async function deleteProgressPhoto(id) {
  return await txDelete('progress_photos', id);
}

// --- Full Backup Export / Import ---
export async function exportFullBackup() {
  const [profile, daily_records, meal_logs, saved_items, progress_photos] = await Promise.all([
    getProfile(),
    getAllDailyRecords(),
    getAllMealLogs(),
    getSavedItems(),
    getAllPhotos()
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    daily_records,
    meal_logs,
    saved_items,
    progress_photos
  };
}

export async function importFullBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file');
  if (data.profile) await txPut('profile', { ...DEFAULT_PROFILE, ...data.profile, id: 'user_profile' });
  if (Array.isArray(data.daily_records)) {
    for (const rec of data.daily_records) {
      if (rec.date) await txPut('daily_records', rec);
    }
  }
  if (Array.isArray(data.meal_logs)) {
    for (const meal of data.meal_logs) {
      if (meal.id) await txPut('meal_logs', meal);
    }
  }
  if (Array.isArray(data.saved_items)) {
    for (const item of data.saved_items) {
      if (item.id) await txPut('saved_items', item);
    }
  }
  if (Array.isArray(data.progress_photos)) {
    for (const photo of data.progress_photos) {
      if (photo.id) await txPut('progress_photos', photo);
    }
  }
  return true;
}
