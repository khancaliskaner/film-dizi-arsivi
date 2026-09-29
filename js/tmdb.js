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

  // TMDB'nin ham sonucunu uygulamanın kullandığı sade biçime çevirir (arama ve listeler ortak kullanır).
  mapResult(result, tmdbType) {
    return {
      tmdbId: result.id,
      tmdbType,
      title: result.title || result.name,
      originalTitle: result.original_title || result.original_name,
      year: Number((result.release_date || result.first_air_date || '').slice(0, 4)) || null,
      poster: result.poster_path || '',
      overview: result.overview || '',
      voteAverage: result.vote_average || 0,
      originalLanguage: result.original_language || ''
    };
  },

  // İsme göre film ve dizi arar (kişileri ayıklar), en fazla 8 sonuç döndürür.
  async search(query, signal) {
    const data = await this.request('/search/multi', { query, include_adult: 'false' }, signal);
    return data.results
      .filter(result => result.media_type === 'movie' || result.media_type === 'tv')
      .slice(0, 8)
      .map(result => this.mapResult(result, result.media_type));
  },

  // Keşfet sayfasının filtreli listesi. kind = 'movie' | 'tv'. Sayfa sayfa gelir.
  // filters: { sort: 'popular' | 'top' | 'newest', genre, year, minRating, language, provider } (boş olanlar yok sayılır)
  //   year: "2019" (tek yıl) ya da "d2010" (2010'lar); provider: Türkiye'deki platformun TMDB numarası.
  async discover(kind, filters, page) {
    const dateField = kind === 'movie' ? 'primary_release_date' : 'first_air_date';
    const params = {
      page,
      include_adult: 'false',
      sort_by: { popular: 'popularity.desc', top: 'vote_average.desc', newest: dateField + '.desc' }[filters.sort]
    };
    if (filters.genre) params.with_genres = filters.genre;
    if (filters.language) params.with_original_language = filters.language;
    if (filters.minRating) params['vote_average.gte'] = filters.minRating;
    if (filters.provider) {
      params.with_watch_providers = filters.provider;
      params.watch_region = 'TR';
    }

    let from = '';
    let to = '';
    if (/^\d{4}$/.test(filters.year)) {
      from = filters.year + '-01-01';
      to = filters.year + '-12-31';
    } else if (/^d\d{4}$/.test(filters.year)) {
      from = filters.year.slice(1) + '-01-01';
      to = Number(filters.year.slice(1)) + 9 + '-12-31';
    }
    // "En yeni" sıralamasında henüz çıkmamış yapımlar görünmesin
    const today = new Date().toISOString().slice(0, 10);
    if (filters.sort === 'newest' && (!to || to > today)) to = today;
    if (from) params[dateField + '.gte'] = from;
    if (to) params[dateField + '.lte'] = to;

    // "En beğenilen" 3 oyla 10 alan tanınmamış yapımlarla dolmasın diye en az oy sayısı şart koşulur
    const narrowed = filters.genre || filters.language || filters.provider || filters.year;
    const minVotes = filters.sort === 'top' ? (narrowed ? 100 : 300) : filters.sort === 'newest' ? 5 : (filters.minRating ? 50 : 0);
    if (minVotes) params['vote_count.gte'] = minVotes;

    return this.toPage(await this.request(`/discover/${kind}`, params), kind);
  },

  // Filtre kutuları için tür listesi (Türkçe adlarıyla)
  async genres(kind) {
    const data = await this.request(`/genre/${kind}/list`);
    return data.genres.map(genre => ({ id: String(genre.id), name: genre.name }));
  },

  // Filtre kutusu için Türkiye'de en çok kullanılan 15 platform (Netflix, Prime Video…)
  async providers(kind) {
    const data = await this.request(`/watch/providers/${kind}`, { watch_region: 'TR' });
    const rank = provider => provider.display_priorities?.TR ?? provider.display_priority ?? 999;
    return data.results
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 15)
      .map(provider => ({ id: String(provider.provider_id), name: provider.provider_name }));
  },

  // Keşfet sayfasındaki arama: sadece seçili türde (film veya dizi) arar.
  async searchKind(kind, query, page) {
    const data = await this.request(`/search/${kind}`, { query, page, include_adult: 'false' });
    return this.toPage(data, kind);
  },

  toPage(data, kind) {
    return {
      page: data.page,
      totalPages: Math.min(data.total_pages, 500), // TMDB en fazla 500 sayfa veriyor
      results: data.results.map(result => this.mapResult(result, kind))
    };
  },

  // Dünyadaki kullanıcıların yorumları. Çoğu İngilizce olduğu için dil İngilizce istenir.
  async reviews(kind, id) {
    const data = await this.request(`/${kind}/${id}/reviews`, { language: 'en-US' });
    return data.results.map(review => ({
      author: review.author_details?.username || review.author || 'Anonim',
      rating: review.author_details?.rating || null, // 10 üzerinden
      date: (review.created_at || '').slice(0, 10),
      content: review.content || ''
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

  // En uygun YouTube fragmanı: { key, name } ya da yoksa null.
  // Sıralama: Fragman > Teaser; Türkçe ve resmi olanlar biraz daha önde.
  async trailer(kind, id) {
    const data = await this.request(`/${kind}/${id}/videos`, { include_video_language: 'tr,en' });
    const score = video => ({ Trailer: 4, Teaser: 2 }[video.type] || 0) + (video.iso_639_1 === 'tr' ? 1.5 : 0) + (video.official ? 0.5 : 0);
    const best = (data.results || [])
      .filter(video => video.site === 'YouTube' && /^[\w-]{11}$/.test(video.key) && score(video) >= 2)
      .sort((a, b) => score(b) - score(a))[0];
    return best ? { key: best.key, name: best.name || 'Fragman' } : null;
  },

  // Yapımın IMDb numarası ("tt0816692"); yoksa boş metin
  async imdbId(kind, id) {
    const data = await this.request(`/${kind}/${id}/external_ids`);
    return /^tt\d+$/.test(data.imdb_id || '') ? data.imdb_id : '';
  },

  // Oyuncular (ilk 12, başrolden başlayarak) ve filmlerde yönetmen. Dizilerde tüm sezonların oyuncuları gelir.
  async credits(kind, id) {
    const data = await this.request(`/${kind}/${id}/${kind === 'tv' ? 'aggregate_credits' : 'credits'}`);
    return {
      cast: (data.cast || []).slice(0, 12).map(person => ({
        name: person.name,
        character: (kind === 'tv' ? person.roles?.[0]?.character : person.character) || '',
        photo: this.posterUrl(person.profile_path, 'w185')
      })),
      directors: (data.crew || []).filter(person => person.job === 'Director').map(person => person.name)
    };
  },

  // Türkiye'de şu an hangi platformlarda izlenebildiği (veriyi TMDB'ye JustWatch sağlıyor).
  // Dönen değer: { link, groups: [{ label, providers: [{ name, logo }] }] }; hiç platform yoksa groups boş.
  async watchProviders(kind, id) {
    const data = await this.request(`/${kind}/${id}/watch/providers`);
    const turkey = data.results?.TR || {};
    const labels = [
      ['flatrate', 'Abonelikle izle'],
      ['free', 'Ücretsiz'],
      ['ads', 'Reklamlı ücretsiz'],
      ['rent', 'Kirala'],
      ['buy', 'Satın al']
    ];
    return {
      link: turkey.link || '',
      groups: labels
        .filter(([key]) => turkey[key]?.length)
        .map(([key, label]) => ({
          label,
          providers: turkey[key].map(provider => ({
            name: provider.provider_name,
            logo: this.posterUrl(provider.logo_path, 'w92')
          }))
        }))
    };
  },

  // Anahtarın çalışıp çalışmadığını dener (Ayarlar penceresindeki "Kaydet" için).
  async test() {
    await this.request('/configuration');
  }
};
