-- Add the optional Indian food-category marker. NULL intentionally renders no symbol.
CREATE TYPE "FoodType" AS ENUM ('VEG', 'NON_VEG');
ALTER TABLE "Item" ADD COLUMN "foodType" "FoodType";

-- Apply the confirmed classification to existing menu data in every store.
UPDATE "Item"
SET "foodType" = CASE "name"
  WHEN 'Crispy Chicken Roll' THEN 'NON_VEG'::"FoodType"
  WHEN 'Chicken Tikka Roll' THEN 'NON_VEG'::"FoodType"
  WHEN 'Crispy Chicken Burger' THEN 'NON_VEG'::"FoodType"
  WHEN 'Chicken Popcorn' THEN 'NON_VEG'::"FoodType"
  WHEN 'Paneer Tikka Roll' THEN 'VEG'::"FoodType"
  WHEN 'Falafel Roll' THEN 'VEG'::"FoodType"
  WHEN 'Veg Falafel Burger' THEN 'VEG'::"FoodType"
  WHEN 'Falafel Box' THEN 'VEG'::"FoodType"
  WHEN 'Classic Fries' THEN 'VEG'::"FoodType"
  WHEN 'Peri Peri Fries' THEN 'VEG'::"FoodType"
  WHEN 'Cheese' THEN 'VEG'::"FoodType"
  WHEN 'Magic Combo' THEN 'VEG'::"FoodType"
  WHEN 'Classic Cold Coffee' THEN 'VEG'::"FoodType"
  WHEN 'Iced Lemon Tea' THEN 'VEG'::"FoodType"
  WHEN 'Water 500ml' THEN 'VEG'::"FoodType"
  ELSE NULL
END;

-- Executive Combo is deliberately left NULL: it includes a customer choice of roll.
