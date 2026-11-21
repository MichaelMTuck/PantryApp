// Validate the recipes and convert ingredient text into working database fields.

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

// Accept common spellings and store consistent unit names.
const units = {
  item: 'items',
  items: 'items',
  each: 'items',

  cup: 'cup',
  cups: 'cup',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',

  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lbs',
  lbs: 'lbs',
  pound: 'lbs',
  pounds: 'lbs',

  pint: 'pint',
  pints: 'pint',
  quart: 'quart',
  quarts: 'quart',
  gallon: 'gallon',
  gallons: 'gallon',

  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',

  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',

  can: 'can',
  cans: 'can',

  pinch: 'pinch',
  pinches: 'pinch',
};

// Support strings with semicolon breaks and arrays of strings
function splitEntries(value, label) {
  const entries = typeof value === 'string'
    ? value.split(';')
    : value;

  if (
    !Array.isArray(entries) ||
    entries.length > 100 ||
    entries.some(entry => typeof entry !== 'string')
  ) {
    fail(`${label} too many text entries.`);
  }

  const cleaned = entries
    .map(entry => entry.trim())
    .filter(Boolean);

  if (
    cleaned.length === 0 ||
    cleaned.some(entry => entry.length > 2000)
  ) {
    fail(`${label} are required. Each entry must be at most 2000 characters.`);
  }

  return cleaned;
}

function parseIngredient(text, index) {
  const original = text;

  const fractions = {
    '½': '1/2',
    '¼': '1/4',
    '¾': '3/4',
    '⅓': '1/3',
    '⅔': '2/3',
    '⅛': '1/8',
    '⅜': '3/8',
    '⅝': '5/8',
    '⅞': '7/8',
  };

  // Convert fraction characters into parseable data.
  text = text
    .replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞])/g, '$1 $2')
    .replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, character => fractions[character]);

  // Examples: "2 cups flour", "1/2 tsp salt", "1 1/2 cups milk".
  const match =
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|\.\d+)\s+([a-zA-Z.]+)\s+(?:of\s+)?(.+)$/i.exec(text);

  if (!match) {
    fail(
      `Ingredient ${index + 1}: use quantity, unit, and name, ` +
      'such as "2 cups flour" or "1 item onion".'
    );
  }

  const quantity = match[1]
    .split(/\s+/)
    .reduce((total, part) => {
      const numbers = part.split('/').map(Number);

      return total + (
        numbers.length === 2
          ? numbers[0] / numbers[1]
          : numbers[0]
      );
    }, 0);

  const unitText = match[2].toLowerCase().replace(/\.$/, '');
  const unit = units[unitText];
  const name = match[3].trim();

  if (!unit) {
    fail(
      `Ingredient ${index + 1}: unrecognized unit "${match[2]}". ` +
      'Try cups, tsp, tbsp, items, oz, lbs, g, kg, ml, l, can, clove, or pinch.'
    );
  }

  if (
    !Number.isFinite(quantity) ||
    quantity < 0.0001 ||
    quantity > 1000000000
  ) {
    fail(`Ingredient ${index + 1}: enter a valid positive quantity.`);
  }

  if (!name || name.length > 150) {
    fail(`Ingredient ${index + 1}: name must be between 1–150 characters.`);
  }

  return {
    name,
    quantity: Math.round(quantity * 10000) / 10000,
    unit,
    note: original,
  };
}

function validateRecipe(body) {
  const { name, time, servings, ingredients, steps } = body ?? {};

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 150
  ) {
    fail('Recipe name must be between 1–150 characters.');
  }

  if (
    !Number.isInteger(time) ||
    time <= 0 ||
    time > 1000
  ) {
    fail('Time must be a positive number of whole minutes, up to 1000.');
  }

  if (
    typeof servings !== 'number' ||
    !Number.isFinite(servings) ||
    servings < 0.01 ||
    servings > 9999.99
  ) {
    fail('Servings must be a number between 0.01 and 9999.99.');
  }

  return {
    name: name.trim(),
    time,
    servings,
    ingredients: splitEntries(ingredients, 'Ingredients')
      .map(parseIngredient),
    steps: splitEntries(steps, 'Steps'),
  };
}

module.exports = { validateRecipe };
