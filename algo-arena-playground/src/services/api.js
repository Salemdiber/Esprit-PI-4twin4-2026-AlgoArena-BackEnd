const BASE_URL = '/playground';

export async function fetchChallenges() {
  const res = await fetch(`${BASE_URL}/challenges`);
  if (!res.ok) throw new Error(`Failed to fetch challenges: ${res.status}`);
  const data = await res.json();
  // API returns { challenges: [...] }
  return Array.isArray(data) ? data : (data.challenges || []);
}

export async function fetchChallengeById(id) {
  const res = await fetch(`${BASE_URL}/challenges/${id}`);
  if (!res.ok) throw new Error(`Challenge not found: ${res.status}`);
  return res.json();
}

export async function runCode({ code, language, input, challengeId }) {
  const res = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language, input, challengeId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Execution failed: ${res.status}`);
  }
  return res.json();
}
