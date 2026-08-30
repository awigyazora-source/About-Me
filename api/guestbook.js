export default async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'Database belum terhubung' });
  }

  const headers = { Authorization: `Bearer ${KV_TOKEN}` };

  // Daftar kata yang diblokir (bisa kamu tambah/kurangi sendiri)
  const BLOCKED_WORDS = [
 'anjing', 'bangsat', 'goblok', 'tolol', 'bego', 'kontol', 'memek',
    'babi', 'idiot', 'bodoh', 'jelek', 'sampah', 'bacot', 'kampret', 'jembut', 'brengsek', 'jembutan', 'perek', 'longor', 'bajingan', 'tai', 'sialan', 'tempek', 'tetek','silit'
  ];

  function containsNegativeWord(text) {
    const lower = text.toLowerCase();
    return BLOCKED_WORDS.some(word => lower.includes(word));
  }

  if (req.method === 'GET') {
    const offset = parseInt(req.query.offset || '0');
    const limit = 15;
    const end = offset + limit - 1;

    const listRes = await fetch(`${KV_URL}/lrange/guestbook/${offset}/${end}`, { headers });
    const listData = await listRes.json();
    const messages = (listData.result || []).map(item => JSON.parse(item));

    const countRes = await fetch(`${KV_URL}/llen/guestbook`, { headers });
    const countData = await countRes.json();
    const total = countData.result || 0;

    return res.status(200).json({ messages, hasMore: offset + limit < total });
  }

  if (req.method === 'POST') {
    const { name, message } = req.body;

    if (!name || !message || !name.trim() || !message.trim()) {
      return res.status(400).json({ error: 'Nama dan pesan wajib diisi' });
    }
    if (name.length > 30 || message.length > 200) {
      return res.status(400).json({ error: 'Nama maks 30 karakter, pesan maks 200 karakter' });
    }

    // Cek kata negatif di nama ATAU pesan
    if (containsNegativeWord(name) || containsNegativeWord(message)) {
      return res.status(400).json({ error: 'Pesan mengandung kata yang tidak pantas, coba tulis ulang ya!' });
    }

    const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0];
    const rlRes = await fetch(`${KV_URL}/set/ratelimit:gb:${ip}/1/EX/30/NX`, { headers });
    const rlData = await rlRes.json();

    if (rlData.result !== 'OK') {
      return res.status(429).json({ error: 'Tunggu sebentar dulu sebelum kirim pesan lagi ya!' });
    }

    const entry = {
      name: name.trim().slice(0, 30),
      message: message.trim().slice(0, 200),
      time: new Date().toISOString()
    };

    await fetch(`${KV_URL}/lpush/guestbook/${encodeURIComponent(JSON.stringify(entry))}`, { headers });
    await fetch(`${KV_URL}/ltrim/guestbook/0/199`, { headers });

    return res.status(200).json({ success: true, entry });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}