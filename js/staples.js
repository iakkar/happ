/**
 * Core Built-in Food & Snack Database (per 100g or standard unit)
 * Used for instant search & offline natural language parsing fallback.
 */

export const STAPLE_FOODS = [
  // Meats & Poultry
  { id: 'st_chicken_breast', name: 'Chicken Breast (Cooked)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6 },
  { id: 'st_chicken_thigh', name: 'Chicken Thigh (Cooked)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 209, protein: 26.0, carbs: 0.0, fat: 10.9 },
  { id: 'st_turkey_breast', name: 'Turkey Breast (Lean)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 135, protein: 30.0, carbs: 0.0, fat: 1.0 },
  { id: 'st_ground_beef_5', name: 'Lean Ground Beef (95/5)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 172, protein: 26.0, carbs: 0.0, fat: 6.5 },
  { id: 'st_ground_beef_15', name: 'Ground Beef (85/15)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 250, protein: 25.0, carbs: 0.0, fat: 15.0 },
  { id: 'st_sirloin_steak', name: 'Sirloin Steak (Grilled)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 206, protein: 27.5, carbs: 0.0, fat: 9.8 },
  { id: 'st_salmon', name: 'Atlantic Salmon (Cooked)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 208, protein: 20.4, carbs: 0.0, fat: 13.4 },
  { id: 'st_tuna_canned', name: 'Tuna in Water (Drained)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 116, protein: 25.5, carbs: 0.0, fat: 0.8 },
  { id: 'st_shrimp', name: 'Shrimp / Prawns (Cooked)', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 99, protein: 24.0, carbs: 0.2, fat: 0.3 },
  { id: 'st_pork_tenderloin', name: 'Pork Tenderloin', category: 'Protein', servingSize: 100, servingUnit: 'g', calories: 143, protein: 26.0, carbs: 0.0, fat: 3.5 },

  // Eggs & Dairy
  { id: 'st_whole_egg', name: 'Whole Egg (Large, ~50g)', category: 'Dairy & Eggs', servingSize: 1, servingUnit: 'egg', gramsPerUnit: 50, calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { id: 'st_egg_whites', name: 'Liquid Egg Whites', category: 'Dairy & Eggs', servingSize: 100, servingUnit: 'g', calories: 52, protein: 11.0, carbs: 0.7, fat: 0.2 },
  { id: 'st_greek_yogurt_0', name: 'Greek Yogurt (0% Fat)', category: 'Dairy & Eggs', servingSize: 100, servingUnit: 'g', calories: 59, protein: 10.3, carbs: 3.6, fat: 0.4 },
  { id: 'st_greek_yogurt_2', name: 'Greek Yogurt (2% Fat)', category: 'Dairy & Eggs', servingSize: 100, servingUnit: 'g', calories: 73, protein: 9.9, carbs: 3.8, fat: 1.9 },
  { id: 'st_cottage_cheese', name: 'Cottage Cheese (Low Fat)', category: 'Dairy & Eggs', servingSize: 100, servingUnit: 'g', calories: 82, protein: 11.1, carbs: 4.3, fat: 2.3 },
  { id: 'st_milk_semi', name: 'Semi-Skimmed Milk (1.5%)', category: 'Dairy & Eggs', servingSize: 100, servingUnit: 'ml', calories: 47, protein: 3.4, carbs: 4.8, fat: 1.5 },
  { id: 'st_cheddar', name: 'Cheddar Cheese', category: 'Dairy & Eggs', servingSize: 30, servingUnit: 'g', calories: 120, protein: 7.5, carbs: 0.4, fat: 9.9 },
  { id: 'st_mozzarella', name: 'Light Mozzarella', category: 'Dairy & Eggs', servingSize: 100, servingUnit: 'g', calories: 165, protein: 20.5, carbs: 1.5, fat: 8.5 },
  { id: 'st_whey_scoop', name: 'Whey Protein Isolate (1 Scoop)', category: 'Supplements', servingSize: 1, servingUnit: 'scoop', gramsPerUnit: 30, calories: 115, protein: 25.0, carbs: 1.5, fat: 0.8 },

  // Grains, Carbs & Starches
  { id: 'st_white_rice', name: 'White Rice (Cooked)', category: 'Carbs & Grains', servingSize: 100, servingUnit: 'g', calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 },
  { id: 'st_brown_rice', name: 'Brown Rice (Cooked)', category: 'Carbs & Grains', servingSize: 100, servingUnit: 'g', calories: 112, protein: 2.6, carbs: 23.5, fat: 0.9 },
  { id: 'st_oats', name: 'Rolled Oats (Dry)', category: 'Carbs & Grains', servingSize: 100, servingUnit: 'g', calories: 379, protein: 13.2, carbs: 67.7, fat: 6.5 },
  { id: 'st_pasta_cooked', name: 'Pasta (Cooked)', category: 'Carbs & Grains', servingSize: 100, servingUnit: 'g', calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9 },
  { id: 'st_potato_baked', name: 'White Potato (Boiled/Baked)', category: 'Carbs & Grains', servingSize: 100, servingUnit: 'g', calories: 87, protein: 1.9, carbs: 20.1, fat: 0.1 },
  { id: 'st_sweet_potato', name: 'Sweet Potato (Cooked)', category: 'Carbs & Grains', servingSize: 100, servingUnit: 'g', calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1 },
  { id: 'st_sourdough', name: 'Sourdough Bread (1 Slice)', category: 'Carbs & Grains', servingSize: 1, servingUnit: 'slice', gramsPerUnit: 45, calories: 120, protein: 4.5, carbs: 23.0, fat: 0.8 },
  { id: 'st_quinoa', name: 'Quinoa (Cooked)', category: 'Carbs & Grains', servingSize: 100, servingUnit: 'g', calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9 },
  { id: 'st_rice_cake', name: 'Rice Cake (1 Cake)', category: 'Snacks', servingSize: 1, servingUnit: 'cake', gramsPerUnit: 9, calories: 35, protein: 0.7, carbs: 7.3, fat: 0.3 },

  // Fats, Oils & Nuts
  { id: 'st_olive_oil', name: 'Extra Virgin Olive Oil (1 tbsp)', category: 'Fats & Nuts', servingSize: 1, servingUnit: 'tbsp', gramsPerUnit: 14, calories: 119, protein: 0.0, carbs: 0.0, fat: 13.5 },
  { id: 'st_butter', name: 'Butter', category: 'Fats & Nuts', servingSize: 10, servingUnit: 'g', calories: 72, protein: 0.1, carbs: 0.0, fat: 8.1 },
  { id: 'st_peanut_butter', name: 'Natural Peanut Butter', category: 'Fats & Nuts', servingSize: 32, servingUnit: 'g', calories: 190, protein: 8.0, carbs: 6.0, fat: 16.0 },
  { id: 'st_almonds', name: 'Raw Almonds', category: 'Fats & Nuts', servingSize: 30, servingUnit: 'g', calories: 173, protein: 6.4, carbs: 6.5, fat: 15.0 },
  { id: 'st_walnuts', name: 'Walnuts', category: 'Fats & Nuts', servingSize: 30, servingUnit: 'g', calories: 196, protein: 4.6, carbs: 4.1, fat: 19.6 },
  { id: 'st_avocado', name: 'Avocado', category: 'Fats & Nuts', servingSize: 100, servingUnit: 'g', calories: 160, protein: 2.0, carbs: 8.5, fat: 14.7 },

  // Fruits & Veggies
  { id: 'st_banana', name: 'Banana (Medium, ~118g)', category: 'Fruit & Veg', servingSize: 1, servingUnit: 'medium', gramsPerUnit: 118, calories: 105, protein: 1.3, carbs: 27.0, fat: 0.4 },
  { id: 'st_apple', name: 'Apple (Medium, ~180g)', category: 'Fruit & Veg', servingSize: 1, servingUnit: 'medium', gramsPerUnit: 180, calories: 95, protein: 0.5, carbs: 25.0, fat: 0.3 },
  { id: 'st_blueberries', name: 'Blueberries', category: 'Fruit & Veg', servingSize: 100, servingUnit: 'g', calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3 },
  { id: 'st_strawberries', name: 'Strawberries', category: 'Fruit & Veg', servingSize: 100, servingUnit: 'g', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },
  { id: 'st_broccoli', name: 'Broccoli (Steamed)', category: 'Fruit & Veg', servingSize: 100, servingUnit: 'g', calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4 },
  { id: 'st_spinach', name: 'Spinach', category: 'Fruit & Veg', servingSize: 100, servingUnit: 'g', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },

  // Popular Snacks
  { id: 'st_protein_bar', name: 'High-Protein Bar (60g)', category: 'Snacks', servingSize: 1, servingUnit: 'bar', gramsPerUnit: 60, calories: 205, protein: 20.0, carbs: 21.0, fat: 7.0 },
  { id: 'st_dark_choc', name: 'Dark Chocolate (85%)', category: 'Snacks', servingSize: 30, servingUnit: 'g', calories: 175, protein: 3.0, carbs: 9.0, fat: 14.5 },
  { id: 'st_honey', name: 'Honey (1 tbsp)', category: 'Snacks', servingSize: 1, servingUnit: 'tbsp', gramsPerUnit: 21, calories: 64, protein: 0.1, carbs: 17.3, fat: 0.0 }
];
