export function generateDishFromGroups(groups, profile, household) {
  const protein = groups.protein || [];
  const veg = groups.vegetable || [];
  const grain = groups.grain || [];
  const dairy = groups.dairy || [];
  const vegNames = veg.map(v => v.name).join(' + ');
  const proteinName = protein.length ? protein[0].name : null;
  const grainName = grain.length ? grain[0].name : null;
  const dairyName = dairy.length ? dairy[0].name : null;

  let name;
  if (proteinName && vegNames) name = proteinName + ' ' + vegNames.split(' + ')[0] + ' Bowl';
  else if (grainName && vegNames) name = vegNames.split(' + ')[0] + ' ' + grainName;
  else if (dairyName && vegNames) name = dairyName + ' ' + vegNames.split(' + ')[0] + ' Curry';
  else if (vegNames) name = vegNames.split(' + ').slice(0,2).join(' + ') + ' Sabzi';
  else name = 'Simple Household Dish';

  const diet = (household?.members || []).some(m => m.diet === 'nonveg') && protein.length
    ? (protein[0].category === 'protein' && /chicken|fish|mutton|prawn/i.test(protein[0].name || '') ? 'nonveg' : 'veg')
    : 'veg';

  return {
    name,
    diet,
    slots: ['lunch','dinner'],
    spice: profile?.spiceTarget || 3,
    oil: profile?.oilTarget || 3,
    weight: 'medium',
    weatherFit: ['mild'],
    ingredients: [...grain, ...protein, ...veg, ...dairy].map(g => ({
      ingredientId: g._id,
      qtyPerServing: 100,
      essential: true
    })),
    tags: ['generated'],
    prepMinutes: 25,
    caloriesApprox: 350,
    steps: ['Prep ingredients', 'Cook in a pan with basic spices', 'Adjust seasoning and serve hot'],
    estimatedCostPerServingINR: 45,
    generated: true
  };
}
