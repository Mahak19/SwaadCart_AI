import { describe, it, expect } from 'vitest';
import { hardFilterDish, memberAllergies } from '../services/mealmind/scorer.js';

const profile = { neverDishIds: [], neverIngredientIds: [] };

const vegDish = {
  _id: 'd1',
  name: 'Paneer Tikka Masala',
  diet: 'veg',
  ingredients: [{ ingredientId: 'i1' }, { ingredientId: 'i2' }]
};

const nonvegDish = {
  _id: 'd2',
  name: 'Chicken Biryani',
  diet: 'nonveg',
  ingredients: [{ ingredientId: 'i3' }]
};

const ingredientMap = new Map([
  ['i1', { name: 'Paneer', category: 'dairy' }],
  ['i2', { name: 'Tomato', category: 'vegetable' }],
  ['i3', { name: 'Chicken', category: 'meat' }]
]);

function household(diet) {
  return { members: [{ name: 'Test', diet, allergies: [] }] };
}

describe('memberAllergies', () => {
  it('collects unique lowercase allergies from all members', () => {
    const hh = {
      members: [
        { allergies: ['Peanut', 'milk'] },
        { allergies: ['peanut'] },
        { allergies: [] }
      ]
    };
    expect(memberAllergies(hh)).toEqual(['peanut', 'milk']);
  });

  it('returns an empty list when there are no members', () => {
    expect(memberAllergies({ members: [] })).toEqual([]);
  });
});

describe('hardFilterDish', () => {
  it('rejects non-veg dishes for a veg household', () => {
    expect(hardFilterDish(nonvegDish, profile, household('veg'))).toBe(false);
    expect(hardFilterDish(vegDish, profile, household('veg'))).toBe(true);
  });

  it('rejects dairy dishes for a vegan household', () => {
    expect(hardFilterDish(vegDish, profile, household('vegan'), [], ingredientMap)).toBe(false);
  });

  it('rejects dishes containing a member allergy', () => {
    const hh = { members: [{ name: 'Test', diet: 'veg', allergies: ['paneer'] }] };
    expect(hardFilterDish(vegDish, profile, hh, [], ingredientMap)).toBe(false);
  });

  it('rejects dishes in the never-eat list', () => {
    const p = { neverDishIds: ['d1'], neverIngredientIds: [] };
    expect(hardFilterDish(vegDish, p, household('veg'))).toBe(false);
  });

  it('rejects recently cooked dishes', () => {
    expect(hardFilterDish(vegDish, profile, household('veg'), ['d1'])).toBe(false);
  });
});
