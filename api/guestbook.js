export default async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'Database belum terhubung' });
  }

  const headers = { Authorization: `Bearer ${KV_TOKEN}` };

  // GET: ambil daftar pesan (dengan pagination)
  if (req.method === 'GET') {
    const offset = parseInt(req.query.offset || '0');
    const limit = 10;
    const end = offset + limit - 1;

    const listRes = await fetch(`${KV_URL}/lrange/guestbook/${offset}/${end}`, { headers });
    const listData = await listRes.json();
    const messages = (listData.result || []).map(item => JSON.parse(item));

    const countRes = await fetch(`${KV_URL}/llen/guestbook`, { headers });
    const countData = await countRes.json();
    const total = countData.result || 0;

    return res.status(200).json({ messages, hasMore: offset + limit < total });
  }

  // POST: kirim pesan baru
  if (req.method === 'POST') {
    const { name, message } = req.body;

    if (!name || !message || !name.trim() || !message.trim()) {
      return res.status(400).json({ error: 'Nama dan pesan wajib diisi' });
    }
    if (name.length > 30 || message.length > 200) {
      return res.status(400).json({ error: 'Nama maks 30 karakter, pesan maks 200 karakter' });
    }

    // Rate limit sederhana: 1 pesan per 30 detik per IP
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
    await fetch(`${KV_URL}/ltrim/guestbook/0/199`, { headers }); // simpan maks 200 pesan terakhir

    return res.status(200).json({ success: true, entry });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}