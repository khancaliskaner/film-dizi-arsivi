// OMDb ile konuşan kod: IMDb puanını getirir (ücretsiz OMDb anahtarı gerekir). Günlük istek sınırı için puanlar 7 gün saklanır.

const OMDB_API = 'https://www.omdbapi.com/';
const IMDB_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

const Omdb = {
  // Önce Ayarlar'dan girilen anahtara, yoksa config.js dosyasındakine bakar.
  apiKey() {
    return Storage.getSetting('omdbKey') || window.CONFIG?.OMDB_API_KEY || '';
  },

  isReady() {
    return Boolean(this.apiKey());
  },

  // OMDb'ye istek atar. Hata olsa da OMDb bir JSON döndürür; içindeki mesaja bakarak anlaşılır bir hata üretilir.
  async request(params, signal = AbortSignal.timeout(8000)) {
    const url = new URL(OMDB_API);
    url.search = new URLSearchParams({ apikey: this.apiKey(), ...params });
    const response = await fetch(url, { signal });

    let data = {};
    try {
      data = await response.json();
    } catch {
      // JSON gelmediyse aşağıdaki genel hataya düşer
    }
    const problem = String(data.Error || '');
    // OMDb, günlük sınır dolunca da 401 döndürür; o yüzden önce mesaja bakılır
    if (/limit reached/i.test(problem)) throw new Error('OMDb günlük istek sınırı doldu, yarın tekrar dene.');
    if (response.status === 401 || /invalid api key/i.test(problem)) throw new Error('OMDb anahtarı geçersiz.');
    if (!response.ok) throw new Error('OMDb şu an cevap vermiyor.');
    return data;
  },

  // IMDb numarasından ("tt0816692") puanı getirir: { rating: 8.7, votes: 2123456 }.
  // IMDb'de henüz puan yoksa null döner.
  async rating(imdbId) {
    const cache = Storage.getSetting('imdbCache') || {};
    const hit = cache[imdbId];
    if (hit && Date.now() - hit.at < IMDB_CACHE_MS) return { rating: hit.rating, votes: hit.votes };

    const data = await this.request({ i: imdbId });
    const rating = data.Response === 'True' ? parseFloat(data.imdbRating) : NaN;
    if (!Number.isFinite(rating)) return null;

    const result = { rating, votes: parseInt(String(data.imdbVotes).replace(/\D/g, ''), 10) || 0 };
    // Süresi dolmuş kayıtlar atılır, yenisi eklenir
    const fresh = Object.fromEntries(Object.entries(cache).filter(([, entry]) => Date.now() - entry.at < IMDB_CACHE_MS));
    fresh[imdbId] = { ...result, at: Date.now() };
    Storage.setSetting('imdbCache', fresh);
    return result;
  },

  // Anahtarın çalışıp çalışmadığını dener (Ayarlar penceresindeki "Kaydet ve dene" için).
  async test() {
    const data = await this.request({ i: 'tt0111161' });
    if (data.Response !== 'True') throw new Error('OMDb anahtarı geçersiz.');
  }
};
