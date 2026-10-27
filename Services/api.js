const API_URL = 'https://ubuntu-services.tail626008.ts.net/api';

export async function apiRequest(
  path,
  { method = 'GET', token, body } = {}
) {
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new Error(
      'Cannot reach the server. Check your connection and Tailscale.'
    );
  }

  if (response.status === 204) {
    return null;
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an unexpected response.');
  }

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }

  return data;
}