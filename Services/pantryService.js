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

// Sends an adjustment to the database not a replacement to handle edge cases where mutiple users ubdate the database at the same time
export function adjustPantryQuantity(token, pantryId, itemId, change) {
  return apiRequest(
    `/pantries/${pantryId}/items/${itemId}/quantity`,
    {
      method: 'PATCH',
      token,
      body: { change },
    }
  );
}

// Functions for managing pantry members and creating invites
export function createPantryInvite(token, pantryId) {
  return apiRequest(`/pantries/${pantryId}/invites`, {
    method: 'POST',
    token,
  });
}

export function getPantryMembers(token, pantryId) {
  return apiRequest(`/pantries/${pantryId}/members`, { token });
}

export function acceptPantryInvite(token, code) {
  return apiRequest('/invites/accept', {
    method: 'POST',
    token,
    body: { code },
  });
}