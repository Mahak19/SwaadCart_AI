import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { ingredients as ingredientData } from './ingredients.data.js';
import { dishes as dishData } from './dishes.data.js';
import { dishImages } from '../data/dishImages.js';
import Ingredient from '../models/Ingredient.js';
import Dish from '../models/Dish.js';
import User from '../models/User.js';
import Household from '../models/Household.js';
import TasteProfile from '../models/TasteProfile.js';
import Purchase from '../models/Purchase.js';
import GroceryList from '../models/GroceryList.js';
import InventoryItem from '../models/InventoryItem.js';
import Feedback from '../models/Feedback.js';

function mondayOf(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setHours(0, 0, 0, 0);
  date.setDate(diff);
  return date;
}

async function seedIngredients() {
  const map = new Map();
  for (const ing of ingredientData) {
    const doc = await Ingredient.findOneAndUpdate(
      { name: ing.name },
      {
        $set: {
          name: ing.name,
          nameHi: ing.nameHi,
          aliases: ing.aliases || [],
          category: ing.category,
          baseUnit: ing.baseUnit,
          packSizes: ing.packSizes || [],
          avgPricePerBaseUnitINR: ing.avgPricePerBaseUnitINR,
          shelfLifeDays: ing.shelfLifeDays,
          isStaple: ing.isStaple || false,
          isSeasonal: ing.isSeasonal || false,
          season: ing.season || []
        },
        $setOnInsert: {}
      },
      { upsert: true, new: true }
    );
    map.set(ing.name, doc._id);
  }
  return map;
}

async function seedDishes(ingMap) {
  let unresolved = 0;
  for (const d of dishData) {
    const ingredientRefs = [];
    for (const ref of d.ingredients) {
      const id = ingMap.get(ref.name);
      if (!id) {
        unresolved++;
        continue;
      }
      ingredientRefs.push({ ingredientId: id, qtyPerServing: ref.qtyPerServing, essential: ref.essential !== false });
    }
    await Dish.findOneAndUpdate(
      { name: d.name },
      {
        $set: {
          name: d.name,
          nameHi: d.nameHi,
          slots: d.slots,
          diet: d.diet,
          cuisine: d.cuisine,
          spice: d.spice,
          oil: d.oil,
          weight: d.weight,
          weatherFit: d.weatherFit || [],
          ingredients: ingredientRefs,
          tags: d.tags || [],
          prepMinutes: d.prepMinutes,
          caloriesApprox: d.caloriesApprox,
          steps: d.steps || [],
          estimatedCostPerServingINR: d.estimatedCostPerServingINR,
          isSeasonal: d.isSeasonal || false,
          season: d.season || [],
          ...(dishImages[d.name] ? { imageUrl: dishImages[d.name] } : {})
        }
      },
      { upsert: true }
    );
  }
  if (unresolved) console.log('  unresolved ingredient refs skipped:', unresolved);
}

async function seedHousehold() {
  const passwordHash = await bcrypt.hash('Demo@1234', 12);
  const region = { state: 'Delhi', city: 'New Delhi', lat: 28.6139, lng: 77.209 };
  const members = [
    { name: 'Rohan', ageGroup: 'adult', diet: 'nonveg', spiceLevel: 4, oilLevel: 3, consumptionFactor: 1.2 },
    { name: 'Priya', ageGroup: 'adult', diet: 'veg', spiceLevel: 3, oilLevel: 2, consumptionFactor: 1.0 },
    { name: 'Aarav', ageGroup: 'child', diet: 'eggetarian', spiceLevel: 1, oilLevel: 2, consumptionFactor: 0.7 }
  ];

  // Reuse the existing demo user + household so re-seeding never invalidates
  // live sessions (a delete/recreate here would break every open browser tab).
  let user = await User.findOne({ email: 'demo@swaadcart.ai' });
  let household = user && user.householdId ? await Household.findById(user.householdId) : null;

  if (!household) {
    household = await Household.create({
      name: 'Sharma Family',
      ownerId: user ? user._id : new mongoose.Types.ObjectId(),
      weeklyBudgetINR: 3000,
      region,
      members
    });
  } else {
    household.name = 'Sharma Family';
    household.weeklyBudgetINR = 3000;
    household.region = region;
    household.members = members;
    await household.save();
  }

  if (!user) {
    user = await User.create({
      name: 'Rohan Sharma',
      email: 'demo@swaadcart.ai',
      passwordHash,
      householdId: household._id,
      onboardingComplete: true,
      region,
      cuisineMode: 'mixed'
    });
  } else {
    user.name = 'Rohan Sharma';
    user.passwordHash = passwordHash;
    user.householdId = household._id;
    user.onboardingComplete = true;
    user.region = region;
    user.cuisineMode = 'mixed';
    await user.save();
  }

  if (String(household.ownerId) !== String(user._id)) {
    household.ownerId = user._id;
    await household.save();
  }

  await TasteProfile.findOneAndUpdate(
    { householdId: household._id },
    {
      householdId: household._id,
      spiceTarget: 3.5,
      oilTarget: 2.5,
      feedbackCount: 14,
      explorationRate: 0.16,
      cuisineWeights: { 'north-indian': 2, 'chinese': 1, 'south-indian': 0.5 },
      tagWeights: { 'protein-rich': 1.5, 'quick': 1, 'fried': -1 },
      learningLog: [
        { at: new Date(), message: 'Loves paneer dishes', delta: 'ing+2' },
        { at: new Date(), message: 'Prefers lighter breakfasts', delta: 'breakfast-0.2' }
      ]
    },
    { upsert: true }
  );

  return { user, household };
}

async function seedPurchases(householdId, ingMap) {
  await Purchase.deleteMany({ householdId });
  const staples = [
    ['Rice', 5000, 280], ['Wheat Flour', 5000, 210], ['Milk', 2000, 108],
    ['Onion', 2000, 110], ['Tomato', 1500, 68], ['Refined Oil', 1500, 195],
    ['Toor Dal', 1000, 160], ['Curd', 800, 70], ['Chicken', 1000, 230],
    ['Paneer', 400, 180], ['Potato', 3000, 120], ['Egg', 12, 102],
    ['Ginger Garlic Paste', 400, 110], ['Salt', 1000, 22], ['Tea Leaves', 500, 260],
    ['Chickpeas', 500, 80], ['Spinach', 500, 40], ['Lemon', 8, 40],
    ['Butter', 200, 120], ['Peanut', 500, 90]
  ];

  const stores = ['BigBasket', 'DMart', 'Local Kirana', 'Zepto'];
  const purchases = [];
  for (let week = 5; week >= 0; week--) {
    for (const offset of [1, 4]) {
      const date = new Date();
      date.setDate(date.getDate() - week * 7 - offset);
      const items = staples
        .filter((_, i) => (i + week + offset) % 3 !== 0)
        .map(([name, qty, price]) => ({ ingredientId: ingMap.get(name), qty, priceINR: price }));
      const total = items.reduce((s, i) => s + i.priceINR, 0);
      purchases.push({
        householdId,
        date,
        store: stores[(week + offset) % stores.length],
        items,
        totalINR: total
      });
    }
  }
  await Purchase.insertMany(purchases);
  return purchases.length;
}

async function seedGrocery(household, ingMap) {
  await GroceryList.deleteMany({ householdId: household._id });
  const weekStart = mondayOf();
  const picks = [
    ['Rice', 5000, 280, true], ['Wheat Flour', 5000, 210, true], ['Milk', 3000, 162, true],
    ['Onion', 2000, 110, true], ['Tomato', 1500, 68, true], ['Refined Oil', 1500, 195, true],
    ['Chicken', 1500, 345, true], ['Paneer', 400, 180, true], ['Curd', 1200, 105, true],
    ['Potato', 3000, 120, true], ['Spinach', 500, 40, true],     ['Egg', 18, 153, false],
    ['Chickpeas', 500, 80, false], ['Peanut', 500, 90, false], ['Lemon', 8, 42, false],
    ['Butter', 200, 120, false], ['Fish', 500, 150, false]
  ];
  const items = picks.map(([name, qty, price, checked]) => ({
    ingredientId: ingMap.get(name),
    qty,
    unit: 'g',
    packSuggestion: qty + ' g',
    estPriceINR: price,
    reasons: ['needed-for-meals', 'frequent-buy'],
    checked,
    addedBy: 'ai'
  }));
  const total = items.reduce((s, i) => s + i.estPriceINR, 0);
  await GroceryList.create({
    householdId: household._id,
    weekStart,
    budgetINR: household.weeklyBudgetINR,
    estimatedTotalINR: total,
    items,
    generatedAt: new Date(),
    version: 1,
    changeLog: [{ at: new Date(), message: 'Weekly plan generated for demo' }]
  });
  return total;
}

async function seedInventory(household, ingMap) {
  await InventoryItem.deleteMany({ householdId: household._id });
  const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  const rows = [
    ['Rice', 1500, 200, 120],
    ['Wheat Flour', 800, 190, 90],
    ['Onion', 600, 195, 25],
    ['Tomato', 300, 197, -1],
    ['Milk', 500, 199, 1],
    ['Spinach', 200, 199, 2],
    ['Paneer', 150, 198, 4],
    ['Egg', 4, 196, 10],
    ['Chicken', 400, 199, 2],
    ['Ginger Garlic Paste', 150, 194, 20],
    ['Curd', 300, 199, 3],
    ['Chickpeas', 400, 190, 150]
  ];
  for (const [name, qty, boughtAgo, expiresIn] of rows) {
    const id = ingMap.get(name);
    if (!id) continue;
    await InventoryItem.create({
      householdId: household._id,
      ingredientId: id,
      quantity: qty,
      purchasedAt: days(-boughtAgo),
      expiresAt: days(expiresIn),
      source: 'purchase'
    });
  }
}

async function seedFeedback(user, household, ingMap) {
  await Feedback.deleteMany({ householdId: household._id });
  const wanted = ['Paneer Butter Masala', 'Aloo Paratha', 'Chole Bhature', 'Bhel Puri', 'Bitter Gourd'];
  const actions = ['love', 'love', 'like', 'dislike', 'never'];
  const reasons = [[], [], [], ['too-bitter'], ['dont-like-ingredient']];
  for (let i = 0; i < wanted.length; i++) {
    const dish = await Dish.findOne({ name: wanted[i] });
    if (!dish) continue;
    await Feedback.create({
      userId: user._id,
      householdId: household._id,
      dishId: dish._id,
      slot: 'dinner',
      action: actions[i],
      reasons: reasons[i],
      ingredientBlamed: actions[i] === 'never' ? ingMap.get('Bitter Gourd') : undefined,
      context: { weatherBucket: 'cool', tempC: 22, cuisineMode: 'mixed' }
    });
  }
}

async function main() {
  console.log('Connecting to', env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);
  console.log('Seeding ingredients...');
  const ingMap = await seedIngredients();
  console.log('  ', ingMap.size, 'ingredients');
  console.log('Seeding dishes...');
  await seedDishes(ingMap);
  console.log('  ', await Dish.countDocuments(), 'dishes total');
  console.log('Seeding demo household + user...');
  const { user, household } = await seedHousehold();
  console.log('  demo@swaadcart.ai / Demo@1234');
  console.log('Seeding purchase history (6 weeks)...');
  console.log('  ', await seedPurchases(household._id, ingMap), 'purchases');
  console.log('Seeding grocery list...');
  const total = await seedGrocery(household, ingMap);
  console.log('  estimated total: Rs', total, 'of Rs', household.weeklyBudgetINR);
  console.log('Seeding inventory...');
  await seedInventory(household, ingMap);
  console.log('Seeding feedback...');
  await seedFeedback(user, household, ingMap);
  console.log('Done.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
