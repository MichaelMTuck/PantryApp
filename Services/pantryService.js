// Service for managing pantry-related operations
import { apiRequest } from './api';

export function getPantries(token) {
  return apiRequest('/pantries', { token });
}

export function createPantry(token, name) {
  return apiRequest('/pantries', {
    method: 'POST',
    token,
    body: { name },
  });
}

export function getPantryItems(token, pantryId) {
  return apiRequest(`/pantries/${pantryId}/items`, { token });
}

export function addPantryItem(token, pantryId, item) {
  return apiRequest(`/pantries/${pantryId}/items`, {
    method: 'POST',
    token,
    body: item,
  });
}

export function updatePantryItem(token, pantryId, itemId, item) {
  return apiRequest(`/pantries/${pantryId}/items/${itemId}`, {
    method: 'PUT',
    token,
    body: item,
  });
}

export function deletePantryItem(token, pantryId, itemId) {
  return apiRequest(`/pantries/${pantryId}/items/${itemId}`, {
    method: 'DELETE',
    token,
  });
}