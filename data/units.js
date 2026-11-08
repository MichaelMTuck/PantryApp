// Imperial units and how much +/- changes the quantity for each
export const UNITS = {
  items: 1,
  oz: 1,
  lbs: 0.5,
  tsp: 1,
  tbsp: 1,
  cup: 0.25,
  pint: 0.5,
  quart: 0.5,
  gallon: 0.25,
};

// Recognizes alternative names for units
const UNIT_ALIASES = {
  item: "items",
  each: "items",
  cups: "cup",
  ounce: "oz",
  ounces: "oz",
  lb: "lbs",
  pound: "lbs",
  pounds: "lbs",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  pints: "pint",
  quarts: "quart",
  gallons: "gallon",
};

// Unknown units return null instead of producing NaN.
export function getQuantityStep(unit) {
  if (typeof unit !== "string") return null;

  const cleaned = unit.trim().toLowerCase();
  const normalized = UNIT_ALIASES[cleaned] || cleaned;

  return Object.prototype.hasOwnProperty.call(UNITS, normalized)
    ? UNITS[normalized]
    : null;
}