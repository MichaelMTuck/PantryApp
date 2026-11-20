import { apiRequest } from './api';

const pathFor = (pantryId) => `/pantries/${pantryId}/shopping-list/items`;

export function getShoppingItems(token, pantryId) {
  return apiRequest(pathFor(pantryId), { token });
}

export function addShoppingItem(token, pantryId, item) {
  return apiRequest(pathFor(pantryId), {
    method: 'POST', token, body: item,
  });
}

export function setShoppingItemChecked(token, pantryId, id, checked) {
  return apiRequest(`${pathFor(pantryId)}/${id}`, {
    method: 'PATCH', token, body: { checked },
  });
}

export function deleteShoppingItem(token, pantryId, id) {
  return apiRequest(`${pathFor(pantryId)}/${id}`, {
    method: 'DELETE', token,
  });
}