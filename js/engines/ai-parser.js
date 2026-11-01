/**
 * Gemini Vision + Text AI Macro Analyzer & Offline Food Parser Engine
 * Supports:
 * 1. Sending Meal Photos (base64 JPEG) + optional description to Gemini API
 * 2. Sending Natural Language Meal / Recipe ingredients to Gemini API
 * 3. Offline Regex & Fuzzy Food Tokenizer fallback when no API key is configured
 * 4. USDA FoodData Central + OpenFoodFacts public search
 */

import { STAPLE_FOODS } from '../staples.js';

/**
 * Compresses an uploaded image File into a lightweight base64 JPEG dataUrl
 * suitable for both Gemini Vision API and IndexedDB progress photo storage.
 */
export function compressImageFile(file, maxWidth = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const FALLBACK_GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite-preview'
];

/**
 * Fetches available generateContent models for the user's Gemini API key
 * and verifies which model responds cleanly.
 */
export async function testGeminiConnection(apiKey, preferredModel = 'gemini-3.1-pro-preview') {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Please enter your Gemini API Key first.');
  }

  let availableModels = [...FALLBACK_GEMINI_MODELS];
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
    const listRes = await fetch(listUrl);
    if (listRes.ok) {
      const listData = await listRes.json();
      const discovered = (listData.models || [])
        .filter(m =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          m.name &&
          m.name.startsWith('models/gemini-')
        )
        .map(m => m.name.replace(/^models\//, ''));
      if (discovered.length > 0) {
        // Put 3.1 / 3 / 2.5 flash/pro models first
        const priority = discovered.filter(n => n.includes('3.1') || n.includes('3-') || n.includes('2.5-flash'));
        const others = discovered.filter(n => !priority.includes(n));
        availableModels = [...new Set([...priority, ...others])];
      }
    }
  } catch {
    // Ignore list error and test directly with candidate models
  }

  const candidates = [
    preferredModel.replace(/^models\//, ''),
    ...FALLBACK_GEMINI_MODELS,
    ...availableModels
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  let lastError = 'Could not connect to Gemini API';
  for (const candidate of candidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with {"status":"ok"}' }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    if (res.ok) {
      return {
        workingModel: candidate,
        availableModels: [candidate, ...availableModels.filter(m => m !== candidate)]
      };
    }

    const errJson = await res.json().catch(() => null);
    lastError = errJson?.error?.message || `HTTP ${res.status}`;
    // If key itself is invalid (400 API_KEY_INVALID or 403), stop immediately
    if (res.status === 400 || res.status === 403) {
      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

/**
 * Calls Google Gemini API with an optional image (base64 dataUrl) and/or text prompt
 * to return structured JSON macros: { mealName, calories, protein, carbs, fat, items[] }.
 * Automatically falls back to gemini-3.1-pro-preview / gemini-3-flash-preview / gemini-2.5-flash
 * if the configured model returns 404.
 */
export async function analyzeMealWithGemini({ apiKey, model = 'gemini-3.1-pro-preview', textPrompt = '', imageDataUrl = null, savedItems = [] }) {
  if (!apiKey || !apiKey.trim()) {
    if (imageDataUrl && !textPrompt.trim()) {
      throw new Error('Please add your Gemini API Key in Settings to analyze food photos, or type the meal description below to use the offline parser.');
    }
    return parseMealOffline(textPrompt, savedItems);
  }

  const parts = [];
  const systemInstruction = `You are an expert sports nutritionist AI. Analyze the provided meal image and/or text description and return ONLY valid JSON matching this schema:
{
  "mealName": "Concise meal title",
  "calories": 550,
  "protein": 45.0,
  "carbs": 52.0,
  "fat": 16.0,
  "items": [
    { "name": "Grilled Chicken Breast", "amount": "200g", "calories": 330, "protein": 62.0, "carbs": 0.0, "fat": 7.2 }
  ]
}
Ensure calories, protein, carbs, and fat are accurate numbers. Do not include markdown fences.`;

  parts.push({
    text: `${systemInstruction}\n\nUser meal description/context: ${textPrompt || 'Analyze the food in this image and estimate portion sizes and macros.'}`
  });

  if (imageDataUrl) {
    const base64Match = imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (base64Match) {
      parts.push({
        inline_data: {
          mime_type: base64Match[1],
          data: base64Match[2]
        }
      });
    }
  }

  const cleanKey = apiKey.trim();
  const cleanModel = (model || 'gemini-3.1-pro-preview').replace(/^models\//, '');
  const candidateModels = [
    cleanModel,
    ...FALLBACK_GEMINI_MODELS.filter(m => m !== cleanModel)
  ];

  let response = null;
  let lastErrText = '';
  let usedModel = cleanModel;

  for (const candidate of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (res.ok) {
      response = res;
      usedModel = candidate;
      break;
    }

    lastErrText = await res.text();
    // Only continue trying fallback models if it's a 404 model availability issue
    if (res.status !== 404) {
      break;
    }
  }

  if (!response || !response.ok) {
    let readableMsg = lastErrText.slice(0, 200);
    try {
      const parsedErr = JSON.parse(lastErrText);
      if (parsedErr?.error?.message) readableMsg = parsedErr.error.message;
    } catch {
      // keep raw slice
    }
    throw new Error(`Gemini API Error: ${readableMsg}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    mealName: parsed.mealName || 'AI Analyzed Meal',
    calories: Math.round(Number(parsed.calories) || 0),
    protein: Math.round((Number(parsed.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(parsed.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(parsed.fat) || 0) * 10) / 10,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    usedModel,
    source: imageDataUrl ? 'ai_vision' : 'ai_text'
  };
}

/**
 * Analyzes 1 or more Smart Scale App Screenshots using Gemini Vision API
 * and extracts the 10 biometric fields (Weight, BMI, Body Fat %, Skeletal Muscle in kg,
 * Visceral Fat, BMR, Body Water %, Bone Mineral Content in kg, Protein %, Muscle Mass in kg).
 */
export async function analyzeScaleScreenshotWithGemini({
  apiKey,
  model = 'gemini-3.1-pro-preview',
  imageDataUrls = []
}) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Please add your Gemini API Key in Profile & AI Settings to scan scale screenshots.');
  }

  const images = (Array.isArray(imageDataUrls) ? imageDataUrls : [imageDataUrls]).filter(Boolean);
  if (images.length === 0) {
    throw new Error('Please select at least one smart scale screenshot.');
  }

  const systemInstruction = `You are a precision biometrics OCR & smart scale report parser (optimized for Huawei Health and smart scale screenshots).
Analyze the provided smart scale screenshot(s) ("Body measurement data" or "Weight" screen) and extract the 10 body composition metrics.
Return ONLY valid JSON matching this exact schema (use null for any metric not visible in the screenshot(s)):
{
  "weight": 101.0,
  "bmi": 31.9,
  "bodyFat": 30.2,
  "skeletalMuscle": 38.0,
  "visceralFat": 17.5,
  "bmr": 2096,
  "bodyWater": 51.1,
  "boneMineral": 2.30,
  "proteinPct": 16.4,
  "muscleMass": 68.1
}

CRITICAL PARSING RULES FOR HUAWEI HEALTH & EUROPEAN NUMBER FORMATS:
1. Comma Decimal vs. Dot Thousands Separator:
   - Screenshots often use European formatting where comma "," is the decimal point (e.g., "101,0 kg" = 101.0, "31,9" = 31.9, "2,30 kg" = 2.30) and period "." is the thousands separator (e.g., "2.096 kcal/d" = 2096).
   - Output all JSON numbers using standard dot decimals and NO thousands separators (e.g., bmr: 2096, NEVER 2.096).
2. Ignore Change/Delta Badges:
   - Ignore small green/red comparison arrows next to values (such as "↓ 0,1", "↑ 0,1", or "0,0 Compared to last time"). Always extract the primary metric number.
3. Top Metric Tiles vs. Bottom "Body composition" Ring Card:
   - For "bodyFat" (%), "bodyWater" (%), and "proteinPct" (%), ALWAYS extract the percentage (%) values from the metric tiles (e.g., Body fat: 30.2%, Body water: 51.1%, Protein: 16.4%), NOT the kg weights listed in the bottom "Body composition (kg)" ring chart.
4. Exact Field Units:
   - "weight": Body weight in kg (e.g., 101.0).
   - "bmi": BMI value (e.g., 31.9).
   - "bodyFat": Body fat percentage in % (e.g., 30.2).
   - "skeletalMuscle": Skeletal muscle mass in kg (e.g., 38.0). If not shown on the screen (e.g. the 8-tile "Weight" view), return null.
   - "visceralFat": Visceral fat level (e.g., 17.5).
   - "bmr": Basal metabolic rate in kcal/d as a whole integer (e.g., "2.096 kcal/d" -> 2096).
   - "bodyWater": Body water percentage in % (e.g., 51.1).
   - "boneMineral": Bone mineral content in kg (e.g., 2.30).
   - "proteinPct": Protein percentage in % (e.g., 16.4).
   - "muscleMass": Muscle mass in kg (e.g., 68.1).
Do not include markdown code fences.`;

  const parts = [{ text: systemInstruction }];
  for (const dataUrl of images) {
    const base64Match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (base64Match) {
      parts.push({
        inline_data: {
          mime_type: base64Match[1],
          data: base64Match[2]
        }
      });
    }
  }

  const cleanModel = (model || 'gemini-3.1-pro-preview').replace(/^models\//, '');
  const candidateModels = [
    cleanModel,
    ...FALLBACK_GEMINI_MODELS.filter(m => m !== cleanModel)
  ];

  let response = null;
  let lastErrText = '';
  let usedModel = cleanModel;

  for (const candidate of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });

    if (res.ok) {
      response = res;
      usedModel = candidate;
      break;
    }

    lastErrText = await res.text();
    if (res.status !== 404) {
      break;
    }
  }

  if (!response || !response.ok) {
    let readableMsg = lastErrText.slice(0, 200);
    try {
      const parsedErr = JSON.parse(lastErrText);
      if (parsedErr?.error?.message) readableMsg = parsedErr.error.message;
    } catch {
      // keep raw slice
    }
    throw new Error(`Gemini API Error: ${readableMsg}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const toNum = (val, decimals = 1, isBmr = false) => {
    if (val === null || val === undefined || val === '') return null;
    const normalized = String(val).trim().replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    let n = Number(normalized);
    if (isNaN(n) || n <= 0) return null;
    if (isBmr && n < 10) {
      n = n * 1000;
    }
    const factor = Math.pow(10, decimals);
    return Math.round(n * factor) / factor;
  };

  return {
    weight: toNum(parsed.weight, 1),
    bmi: toNum(parsed.bmi, 1),
    bodyFat: toNum(parsed.bodyFat, 1),
    skeletalMuscle: toNum(parsed.skeletalMuscle, 1),
    visceralFat: toNum(parsed.visceralFat, 1),
    bmr: toNum(parsed.bmr, 0, true),
    bodyWater: toNum(parsed.bodyWater, 1),
    boneMineral: toNum(parsed.boneMineral, 2),
    proteinPct: toNum(parsed.proteinPct, 1),
    muscleMass: toNum(parsed.muscleMass, 1),
    usedModel
  };
}

/**
 * Smart Offline Natural Language Parser Fallback
 * Parses strings like "250g chicken breast, 150g white rice, 2 whole eggs, 1 tbsp olive oil"
 */
export function parseMealOffline(text, savedItems = []) {
  if (!text || !text.trim()) {
    throw new Error('Please enter a meal description or upload a photo.');
  }

  const allFoods = [
    ...savedItems.map(item => ({
      name: item.name,
      servingSize: Number(item.servingSize) || 100,
      servingUnit: item.servingUnit || 'g',
      gramsPerUnit: item.servingUnit === 'g' ? 1 : 100,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fat: Number(item.fat) || 0
    })),
    ...STAPLE_FOODS
  ];

  // Split by comma, plus, newline, or " and "
  const segments = text
    .split(/,|\+|\n|\band\b/i)
    .map(s => s.trim())
    .filter(Boolean);

  const items = [];
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  const unitMultipliersInGrams = {
    g: 1,
    gram: 1,
    grams: 1,
    ml: 1,
    oz: 28.35,
    cup: 200,
    cups: 200,
    tbsp: 14,
    tsp: 5
  };

  for (const seg of segments) {
    // Match e.g. "200g chicken breast" or "2 eggs" or "1.5 scoops whey"
    const match = seg.match(/^(\d+(?:\.\d+)?)\s*(g|grams?|ml|oz|cups?|tbsp|tsp|scoop|scoops|egg|eggs|slice|slices|bar|bars|medium|serving|servings)?\s*(?:of\s+)?(.+)$/i);

    let qty = 1;
    let unit = '';
    let query = seg.toLowerCase();

    if (match) {
      qty = parseFloat(match[1]) || 1;
      unit = (match[2] || '').toLowerCase();
      query = match[3].trim().toLowerCase();
    }

    // Find best matching food in catalog
    let bestFood = null;
    let bestScore = 0;
    const words = query.split(/\s+/).filter(w => w.length > 2);

    for (const food of allFoods) {
      const fName = food.name.toLowerCase();
      let score = 0;
      if (fName.includes(query)) score += 10;
      for (const w of words) {
        if (fName.includes(w)) score += 3;
      }
      if (score > bestScore) {
        bestScore = score;
        bestFood = food;
      }
    }

    if (bestFood) {
      let factor = 1;
      if (unit && unitMultipliersInGrams[unit]) {
        const totalGrams = qty * unitMultipliersInGrams[unit];
        if (bestFood.servingUnit === 'g' || bestFood.servingUnit === 'ml') {
          factor = totalGrams / bestFood.servingSize;
        } else if (bestFood.gramsPerUnit) {
          factor = totalGrams / bestFood.gramsPerUnit;
        } else {
          factor = totalGrams / 100;
        }
      } else if (!unit && qty >= 15 && (bestFood.servingUnit === 'g' || bestFood.servingUnit === 'ml')) {
        factor = qty / bestFood.servingSize;
      } else {
        factor = qty / (bestFood.servingSize === 100 ? 1 : bestFood.servingSize);
      }

      const kcal = Math.round(bestFood.calories * factor);
      const p = Math.round(bestFood.protein * factor * 10) / 10;
      const c = Math.round(bestFood.carbs * factor * 10) / 10;
      const f = Math.round(bestFood.fat * factor * 10) / 10;

      items.push({
        name: bestFood.name,
        amount: `${qty}${unit ? ' ' + unit : ''}`,
        calories: kcal,
        protein: p,
        carbs: c,
        fat: f
      });

      totalCalories += kcal;
      totalProtein += p;
      totalCarbs += c;
      totalFat += f;
    }
  }

  if (items.length === 0) {
    throw new Error('Could not match foods offline. Try terms like "200g chicken breast, 150g white rice, 2 eggs" or configure your Gemini API key in Settings.');
  }

  return {
    mealName: items.map(i => i.name.split('(')[0].trim()).slice(0, 3).join(' + '),
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
    items,
    source: 'offline_nlp'
  };
}

/**
 * Searches Local Saved Foods + Built-in Staples + OpenFoodFacts / USDA API
 */
export async function searchFoodCatalog(query, savedItems = [], usdaApiKey = 'DEMO_KEY', includeOnline = false) {
  const q = (query || '').trim().toLowerCase();
  const localFoods = [
    ...savedItems.map(item => ({
      ...item,
      sourceBadge: item.itemType === 'meal' ? 'Saved Meal' : 'My Food'
    })),
    ...STAPLE_FOODS.map(st => ({
      ...st,
      itemType: 'food',
      sourceBadge: st.category
    }))
  ];

  const matchedLocal = !q
    ? localFoods
    : localFoods.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.brand && f.brand.toLowerCase().includes(q)) ||
        (f.sourceBadge && f.sourceBadge.toLowerCase().includes(q))
      );

  if (!includeOnline || !q || q.length < 2) {
    return matchedLocal;
  }

  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey || 'DEMO_KEY')}&query=${encodeURIComponent(q)}&pageSize=8`;
    const res = await fetch(url);
    if (!res.ok) return matchedLocal;
    const data = await res.json();
    const onlineFoods = (data.foods || []).map(food => {
      const getNutr = (ids) => {
        const found = (food.foodNutrients || []).find(n => ids.includes(n.nutrientId));
        return found ? Number(found.value) || 0 : 0;
      };
      return {
        id: `usda_${food.fdcId}`,
        itemType: 'food',
        name: food.description,
        brand: food.brandOwner || 'USDA',
        servingSize: 100,
        servingUnit: 'g',
        calories: Math.round(getNutr([1008, 2047])),
        protein: Math.round(getNutr([1003]) * 10) / 10,
        carbs: Math.round(getNutr([1005]) * 10) / 10,
        fat: Math.round(getNutr([1004]) * 10) / 10,
        sourceBadge: 'USDA DB'
      };
    });
    return [...matchedLocal, ...onlineFoods];
  } catch {
    return matchedLocal;
  }
}
