// Service for loading recipes from the database
import { apiRequest } from './api';

export function getRecipes(token, pantryId) {
  return apiRequest(`/pantries/${pantryId}/recipes`, { token });
}

export function getRecipe(token, pantryId, recipeId) {
  return apiRequest(
    `/pantries/${pantryId}/recipes/${recipeId}`,
    { token }
  );
}

export function addRecipe(token, pantryId, recipe){
  return apiRequest(`/pantries/${pantryId}/recipes`, {
    method: 'POST',
    token,
    body : recipe}
  )
}