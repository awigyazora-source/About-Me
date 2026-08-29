export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, systemInstruction } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key belum di-set di server (GEMINI_API_KEY kosong)' });
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Kalau Google balikin error (key salah, model salah, kuota habis, dll),
    // tampilkan pesan aslinya biar gampang di-debug
    if (!response.ok || data.error) {
      console.error('Gemini API error:', JSON.stringify(data));
      return res.status(response.status).json({
        error: data.error?.message || 'Gemini API mengembalikan error',
        details: data.error || data
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('Empty response:', JSON.stringify(data));
      return res.status(502).json({ error: 'Respons kosong dari Gemini', details: data });
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Fetch failed:', err.message);
    return res.status(500).json({ error: 'Gagal menghubungi Gemini API', details: err.message });
  }
}