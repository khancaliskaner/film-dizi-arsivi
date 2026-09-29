// TMDB ile konuşan kod: film/dizi arama ve seçilen yapımın ayrıntılarını (afiş, özet, kategoriler) getirme.

const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/';

const Tmdb = {
  // Önce Ayarlar'dan girilen anahtara, yoksa config.js dosyasındakine bakar.
  apiKey() {
    return Storage.getSetting('tmdbKey') || window.CONFIG?.TMDB_API_KEY || '';
  },

  isReady() {
    return Boolean(this.apiKey());
  },

  // Afiş yolundan ("/abc.jpg") tam resim adresi üretir. Boyutlar: w92, w185, w342, w500
  posterUrl(path, size = 'w342') {
    return path ? TMDB_IMG + size + path : '';
  },

  // TMDB'ye istek atar. 8 saniyede cevap gelmezse vazgeçer.
  // Kısa "API Key" de, uzun "Read Access Token" da çalışır.
  async request(path, params = {}, signal = AbortSignal.timeout(8000)) {
    const key = this.apiKey();
    const isToken = key.length > 40;
    const url = new URL(TMDB_API + path);
    url.search = new URLSearchParams({ language: 'tr-TR', ...params, ...(isToken ? {} : { api_key: key }) });
    const headers = isToken ? { Authorization: 'Bearer ' + key } : {};
    const response = await fetch(url, { signal, headers });
    if (response.status === 401) throw new Error('TMDB anahtarı geçersiz.');
    if (!response.ok) throw new Error('TMDB şu an cevap vermiyor.');
    return response.json();
  },

  // İsme göre film ve dizi arar (kişileri ayıklar), en fazla 8 sonuç döndürür.
  async search(query, signal) {
    const data = await this.request('/search/multi', { query, include_adult: 'false' }, signal);
    return data.results
      .filter(result => result.media_type === 'movie' || result.media_type === 'tv')
      .slice(0, 8)
      .map(result => ({
        tmdbId: result.id,
        tmdbType: result.media_type,
        title: result.title || result.name,
        originalTitle: result.original_title || result.original_name,
        year: Number((result.release_date || result.first_air_date || '').slice(0, 4)) || null,
        poster: result.poster_path || '',
        overview: result.overview || ''
      }));
  },

  // Seçilen yapımın kategorilerini ve özetini getirir. Türkçe özet yoksa İngilizcesini dener.
  async details(tmdbType, tmdbId) {
    const data = await this.request(`/${tmdbType}/${tmdbId}`);
    let overview = data.overview;
    if (!overview) {
      try {
        overview = (await this.request(`/${tmdbType}/${tmdbId}`, { language: 'en-US' })).overview;
      } catch {
        overview = '';
      }
    }
    return {
      genres: (data.genres || []).map(genre => genre.name),
      overview: overview || '',
      poster: data.poster_path || ''
    };
  },

  // Anahtarın çalışıp çalışmadığını dener (Ayarlar penceresindeki "Kaydet" için).
  async test() {
    await this.request('/configuration');
  }
};
