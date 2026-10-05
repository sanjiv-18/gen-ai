// ── API Service Layer ── //
const BASE_URL = '/api';

async function handleResponse(res) {
  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    data = { error: text || `HTTP ${res.status}` };
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function apiUnderstand({ rawText = '', file = null, targetCompany, targetRole, apiKey = '', demoMode = '' }) {
  const formData = new FormData();
  if (file) formData.append('resume', file);
  if (rawText) formData.append('rawText', rawText);
  formData.append('targetCompany', targetCompany || 'other');
  formData.append('targetRole', targetRole || '');
  formData.append('apiKey', apiKey || '');
  formData.append('demoMode', demoMode || '');

  const res = await fetch(`${BASE_URL}/understand`, { method: 'POST', body: formData });
  return handleResponse(res);
}

export async function apiAnalyze({ profile, targetCompany, jd = '', mode, apiKey = '', companyType = '' }) {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, targetCompany, jd, mode, apiKey, companyType })
  });
  return handleResponse(res);
}

export async function apiBuild({ profile, targetCompany, mode, keywords, gapAnswers, userAnswers, jd, rawText, apiKey = '' }) {
  const res = await fetch(`${BASE_URL}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, targetCompany, mode, keywords, gapAnswers, userAnswers, jd, rawText, apiKey })
  });
  return handleResponse(res);
}

export async function apiRevalidate({ bullet, rawText, userAnswers }) {
  const res = await fetch(`${BASE_URL}/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bullet, rawText, userAnswers })
  });
  return handleResponse(res);
}

export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
