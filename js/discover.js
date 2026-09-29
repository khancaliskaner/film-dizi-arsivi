// Keşfet sayfası: TMDB'deki film ve dizileri sıralama + filtrelerle listeler, arama yapar, detay ve dünyadan yorumları gösterir.

const Discover = (() => {
  const section = document.getElementById('discover');
  const gridEl = document.getElementById('disc-grid');
  const statusEl = document.getElementById('disc-status');
  const moreBtn = document.getElementById('disc-more');
  const searchEl = document.getElementById('disc-search');
  const kindBar = document.getElementById('disc-kind');
  const sortBar = document.getElementById('disc-sort');
  const filtersEl = document.getElementById('disc-filters');
  const clearBtn = document.getElementById('f-clear');
  const filterBoxes = {
    genre: document.getElementById('f-genre'),
    year: document.getElementById('f-year'),
    minRating: document.getElementById('f-rating'),
    language: document.getElementById('f-language'),
    provider: document.getElementById('f-provider')
  };
  const hideOwnedBox = document.getElementById('f-hide-owned');

  const detailDialog = document.getElementById('detail-dialog');
  const reviewsEl = document.getElementById('detail-reviews');
  const watchEl = document.getElementById('detail-watch');
  const castEl = document.getElementById('detail-cast');
  const imdbEl = document.getElementById('detail-imdb');
  const trailerEl = document.getElementById('detail-trailer');
  const similarEl = document.getElementById('detail-similar');
  let similarItems = []; // açık yapımın benzerleri
  let trailer = null; // açık yapımın fragmanı: { key, name }

  // Fragman düğmesine basılınca pencerenin içinde oynatıcıyı aç (YouTube'un çerezsiz sürümü)
  trailerEl.addEventListener('click', event => {
    if (!event.target.closest('.trailer-btn') || !trailer) return;
    trailerEl.innerHTML = `
      <div class="trailer-frame">
        <iframe src="https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0"
                title="${escapeHtml(trailer.name)}" loading="lazy" allowfullscreen
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
      <a class="watch-link" href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" rel="noopener noreferrer">YouTube'da aç ↗</a>`;
  });

  // Pencere kapanınca oynatıcı da kapansın (ses arkada çalmaya devam etmesin).
  // Kapatan her yer closeDetail'i çağırır; Esc tuşuyla kapanırsa "close" olayı temizler.
  function closeDetail() {
    trailerEl.innerHTML = '';
    detailDialog.close();
  }
  detailDialog.addEventListener('close', () => { trailerEl.innerHTML = ''; });

  // Fotoğrafı yüklenemeyen oyuncuda baş harfli renkli daire görünür
  castEl.addEventListener('error', event => {
    if (event.target.tagName === 'IMG') event.target.remove();
  }, true);
  const actionsEl = document.getElementById('detail-actions');

  const NO_FILTERS = { genre: '', year: '', minRating: '', language: '', provider: '' };
  const state = {
    kind: 'movie', sort: 'popular', filters: { ...NO_FILTERS }, hideOwned: false,
    query: '', page: 0, totalPages: 0, items: [], loading: false, loaded: false
  };
  const MIN_VISIBLE = 12; // "arşivimde olmayanlar" seçiliyken ekranda en az bu kadar kart olsun diye otomatik sayfa eklenir
  const MAX_TOP_UPS = 5;
  let topUps = 0;
  let emptyNote = ''; // liste boş kalırsa gösterilecek özel açıklama (ör. "Sana özel" için)
  const optionsCache = {}; // kind -> { genres, providers }
  let loadToken = 0;   // eski bir isteğin cevabı geç gelirse yok saymak için
  let detailToken = 0;
  let current = null;        // detay penceresinde açık olan yapım
  let currentDetails = null; // onun kategorileri ve özeti (geldiyse)
  let currentReviews = [];   // onun yorumları

  // ---------- Listeyi yükle ve çiz ----------
  async function load(reset) {
    if (reset) {
      Object.assign(state, { items: [], page: 0, totalPages: 0 });
      posterOk = 0;
      posterFail = 0;
      posterNote.hidden = true;
    }
    if (!Tmdb.isReady()) {
      statusEl.textContent = "Keşfet için TMDB anahtarı gerekiyor. ⚙ Ayarlar'dan ekleyebilirsin.";
      return draw();
    }

    const token = ++loadToken;
    state.loading = true;
    statusEl.textContent = 'Yükleniyor…';
    draw();

    try {
      const next = state.page + 1;
      let data;
      emptyNote = '';
      if (state.query) data = await Tmdb.searchKind(state.kind, state.query, next);
      else if (state.sort === 'foryou') data = await forYou();
      else if (state.sort === 'playing' || state.sort === 'soon') data = await Tmdb.calendar(state.kind, state.sort, next);
      else data = await Tmdb.discover(state.kind, { ...state.filters, sort: state.sort }, next);
      if (token !== loadToken) return;
      const known = new Set(state.items.map(item => item.tmdbId));
      state.items.push(...data.results.filter(item => !known.has(item.tmdbId)));
      // "Yakında" listesi en yakın çıkış tarihinden başlasın
      if (state.sort === 'soon' && !state.query) state.items.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
      state.page = data.page;
      state.totalPages = data.totalPages;
      statusEl.textContent = state.items.length ? '' : (emptyNote || (hasFilters() ? 'Bu filtrelere uyan sonuç bulunamadı.' : 'Sonuç bulunamadı.'));
    } catch (error) {
      if (token !== loadToken) return;
      statusEl.textContent = tmdbErrorMessage(error);
      topUps = MAX_TOP_UPS; // hata varsa otomatik yüklemeyi bırak
    }
    state.loading = false;
    draw();
    if (needsTopUp()) {
      topUps++;
      load(false);
    }
  }

  // "Sana özel": son zamanlarda 4+ puan verdiğin veya beğendiğin (TMDB'den eklenmiş) yapımlara benzeyenler.
  // Birden fazla yapıma benzeyen öne çıkar; arşivinde zaten olanlar ve afişsizler çıkarılır. Tek sayfa döner.
  async function forYou() {
    const one = { page: 1, totalPages: 1 };
    const seeds = Storage.getAll()
      .filter(entry => entry.tmdbId && entry.tmdbType === state.kind && entry.status === 'izledim' && (entry.rating >= 4 || entry.liked))
      .sort((a, b) => (b.watchedDate || b.createdAt).localeCompare(a.watchedDate || a.createdAt))
      .slice(0, 6);
    if (!seeds.length) {
      emptyNote = `Öneri için birkaç ${state.kind === 'tv' ? 'diziye' : 'filme'} 4 yıldız ve üstü puan ver veya ♥ ile beğen (TMDB ile eklenmiş olmaları gerekir).`;
      return { ...one, results: [] };
    }

    const settled = await Promise.allSettled(seeds.map(seed => Tmdb.recommendations(state.kind, seed.tmdbId)));
    if (settled.every(result => result.status === 'rejected')) throw settled[0].reason;

    const owned = ownedMap();
    const scored = new Map();
    settled.forEach((result, index) => {
      if (result.status !== 'fulfilled') return;
      const weight = (seeds[index].rating >= 4.5 ? 1.5 : 1) + (seeds[index].liked ? 0.5 : 0);
      for (const item of result.value) {
        if (!item.poster || owned.has(item.tmdbType + ':' + item.tmdbId)) continue;
        const entry = scored.get(item.tmdbId) || { item, score: 0, because: [] };
        entry.score += weight;
        entry.because.push(seeds[index].title);
        scored.set(item.tmdbId, entry);
      }
    });

    const results = [...scored.values()]
      .sort((a, b) => b.score - a.score || b.item.voteAverage - a.item.voteAverage)
      .slice(0, 40)
      .map(({ item, because }) => ({
        ...item,
        because: because.length === 1
          ? `Şuna benzer: ${because[0]}`
          : `Şunlara benzer: ${because.slice(0, 2).join(', ')}${because.length > 2 ? ` +${because.length - 2}` : ''}`
      }));
    if (!results.length) emptyNote = 'Şimdilik yeni bir öneri çıkmadı. Biraz daha yapıma puan verince öneriler çoğalır.';
    return { ...one, results };
  }

  // Kullanıcının bir şey seçmesiyle başlayan yüklemeler (otomatik sayfa ekleme sayacı sıfırlanır)
  function reload() {
    topUps = 0;
    load(true);
  }

  function visibleItems() {
    if (!state.hideOwned || !usesFilters()) return state.items.map((item, index) => ({ item, index }));
    const owned = ownedMap();
    return state.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !owned.has(item.tmdbType + ':' + item.tmdbId));
  }

  // "Arşivimde olmayanlar" seçiliyken çoğu kart gizlenirse ekran boş kalmasın: sıradaki sayfayı da getir
  function needsTopUp() {
    return state.hideOwned && usesFilters() && !state.loading && state.page < state.totalPages &&
      topUps < MAX_TOP_UPS && visibleItems().length < MIN_VISIBLE;
  }

  // Filtre paneli sadece normal listelerde geçerli: arama, "Sana özel" ve takvim listeleri kendi içeriğini kendisi seçer
  function usesFilters() {
    return !state.query && !['foryou', 'playing', 'soon'].includes(state.sort);
  }

  // "Çıkış: 3 Eki 2026 · 4 gün sonra" (takvim listelerinin kartlarında)
  function releaseLine(date) {
    // "Yayında" dizilerin tarihi, dizinin ilk yayın tarihidir (yıllar önce olabilir)
    let line = `${state.kind === 'tv' && state.sort === 'playing' ? 'İlk yayın' : 'Çıkış'}: ${formatDate(date)}`;
    if (state.sort === 'soon') {
      const days = Math.round((new Date(date) - new Date(today())) / 864e5);
      line += days <= 0 ? ' · bugün' : days === 1 ? ' · yarın' : ` · ${days} gün sonra`;
    }
    return line;
  }

  function hasFilters() {
    return Object.keys(NO_FILTERS).some(key => state.filters[key] !== '') || state.hideOwned;
  }

  // Arşivde hangi yapımlar var? ("film:123" gibi anahtarlarla)
  function ownedMap() {
    const map = new Map();
    for (const entry of Storage.getAll()) {
      if (entry.tmdbId) map.set(entry.tmdbType + ':' + entry.tmdbId, entry);
    }
    return map;
  }

  // İlk yükleme sırasında boş ekran yerine gri iskelet kartlar
  function skeletonHtml() {
    const card = `
      <article class="card skeleton" aria-hidden="true">
        <div class="poster"></div>
        <div class="card-body"><div class="line"></div><div class="line short"></div></div>
      </article>`;
    return card.repeat(12);
  }

  function draw() {
    const owned = ownedMap();
    gridEl.innerHTML = state.loading && !state.items.length
      ? skeletonHtml()
      : visibleItems()
        .map(({ item, index }) => cardHtml(item, index, owned.has(item.tmdbType + ':' + item.tmdbId)))
        .join('');
    moreBtn.hidden = state.loading || !state.items.length || state.page >= state.totalPages;

    for (const button of kindBar.querySelectorAll('button')) button.classList.toggle('active', button.dataset.kind === state.kind);
    for (const button of sortBar.querySelectorAll('button')) button.classList.toggle('active', button.dataset.sort === state.sort);
    // Filmde "Vizyonda" (sinemada), dizide "Yayında" (bu hafta yayınlanan)
    sortBar.querySelector('[data-sort="playing"]').textContent = state.kind === 'tv' ? 'Yayında' : 'Vizyonda';
    // Arama yaparken sıralama ve filtreler işe yaramaz (TMDB aramada bunları desteklemiyor)
    // "Sana özel" de kendi önerisini kendisi seçtiği için filtre almaz
    sortBar.hidden = Boolean(state.query);
    filtersEl.hidden = !usesFilters();
    clearBtn.hidden = !hasFilters();
  }

  function cardHtml(item, index, isOwned) {
    const label = item.tmdbType === 'tv' ? 'Dizi' : 'Film';
    const poster = item.poster
      ? `<img class="poster-img" src="${Tmdb.posterUrl(item.poster)}" alt="${escapeHtml(item.title)} afişi" loading="lazy">`
      : '';
    return `
      <article class="card discover-card" data-index="${index}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)} ayrıntıları">
        <div class="poster" style="--hue:${titleHue(item.title)}">
          <span class="poster-letter">${escapeHtml(item.title.charAt(0).toUpperCase())}</span>
          <span class="poster-title">${escapeHtml(item.title)}</span>
          ${poster}
          <span class="badge">${label}</span>
          ${isOwned ? '<span class="owned-badge" title="Arşivinde var">✓</span>' : ''}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <p class="card-meta">${escapeHtml([item.year, label].filter(Boolean).join(' · '))}</p>
          ${item.voteAverage ? `<p class="card-tmdb">TMDB ${item.voteAverage.toFixed(1)}</p>` : ''}
          ${item.because ? `<p class="card-because">${escapeHtml(item.because)}</p>` : ''}
          ${!state.query && ['playing', 'soon'].includes(state.sort) && item.releaseDate ? `<p class="card-release">${releaseLine(item.releaseDate)}</p>` : ''}
        </div>
      </article>`;
  }

  // ---------- Kontroller ----------
  // Film <-> Dizi: tür ve platform listeleri farklı olabildiği için o iki filtre sıfırlanır
  kindBar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.dataset.kind === state.kind) return;
    state.kind = button.dataset.kind;
    state.filters.genre = '';
    state.filters.provider = '';
    syncBoxes();
    loadOptions();
    reload();
  });

  sortBar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.dataset.sort === state.sort) return;
    state.sort = button.dataset.sort;
    reload();
  });

  // Filtre kutularından biri değişince hepsini oku ve listeyi baştan getir
  filtersEl.addEventListener('change', event => {
    if (event.target === hideOwnedBox) {
      state.hideOwned = hideOwnedBox.checked;
      topUps = 0;
      draw();
      if (needsTopUp()) {
        topUps++;
        load(false);
      }
      return;
    }
    for (const key in filterBoxes) state.filters[key] = filterBoxes[key].value;
    reload();
  });

  clearBtn.addEventListener('click', () => {
    state.filters = { ...NO_FILTERS };
    state.hideOwned = false;
    syncBoxes();
    reload();
  });

  // Kutuların gösterdiği değerleri state ile aynı yap
  function syncBoxes() {
    for (const key in filterBoxes) filterBoxes[key].value = state.filters[key];
    hideOwnedBox.checked = state.hideOwned;
  }

  // Tür ve platform kutularını TMDB'den gelen listelerle doldurur (bir kez getirilir, sonra hatırlanır)
  function fillBox(box, list, allLabel) {
    box.innerHTML = `<option value="">${allLabel}</option>` +
      list.map(entry => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`).join('');
    box.value = state.filters[box === filterBoxes.genre ? 'genre' : 'provider'];
  }

  async function loadOptions() {
    if (!Tmdb.isReady()) return;
    const kind = state.kind;
    try {
      if (!optionsCache[kind]) {
        const [genres, providers] = await Promise.all([Tmdb.genres(kind), Tmdb.providers(kind)]);
        optionsCache[kind] = { genres, providers };
      }
    } catch {
      return; // liste gelmezse bu iki kutu sadece "Tümü" seçeneğiyle kalır, diğer filtreler çalışır
    }
    if (kind !== state.kind) return; // bu arada Film/Dizi değişti
    fillBox(filterBoxes.genre, optionsCache[kind].genres, 'Tüm türler');
    fillBox(filterBoxes.provider, optionsCache[kind].providers, 'Tüm platformlar');
  }

  // Yıl kutusu: dönemler + bu yıldan 1950'ye tek tek yıllar
  (function fillYears() {
    const thisYear = new Date().getFullYear();
    const decades = [];
    for (let start = Math.floor(thisYear / 10) * 10; start >= 1970; start -= 10) {
      decades.push(`<option value="d${start}">${start}'ler</option>`);
    }
    const years = [];
    for (let year = thisYear; year >= 1950; year--) years.push(`<option value="${year}">${year}</option>`);
    filterBoxes.year.innerHTML = '<option value="">Tüm yıllar</option>' +
      `<optgroup label="Dönemler">${decades.join('')}</optgroup><optgroup label="Yıllar">${years.join('')}</optgroup>`;
  })();

  let searchTimer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const query = searchEl.value.trim();
      if (query === state.query) return;
      state.query = query.length >= 2 ? query : '';
      reload();
    }, 400);
  });

  moreBtn.addEventListener('click', () => {
    topUps = 0;
    load(false);
  });

  // Yüklenemeyen afişi kaldır, altındaki renkli yer tutucu görünsün.
  // Hiçbiri yüklenmeden 4 afiş üst üste başarısız olursa, sebebi (afiş sunucusuna erişilememesi) kullanıcıya söylenir.
  const posterNote = document.getElementById('disc-poster-note');
  let posterOk = 0;
  let posterFail = 0;

  gridEl.addEventListener('load', event => {
    if (!event.target.classList.contains('poster-img')) return;
    posterOk++;
    posterNote.hidden = true;
  }, true);

  gridEl.addEventListener('error', event => {
    if (!event.target.classList.contains('poster-img')) return;
    event.target.remove();
    posterFail++;
    if (posterFail >= 4 && posterOk === 0) posterNote.hidden = false;
  }, true);

  function cardFromEvent(event) {
    const card = event.target.closest('.discover-card');
    return card ? state.items[card.dataset.index] : null;
  }

  gridEl.addEventListener('click', event => {
    const item = cardFromEvent(event);
    if (item) openDetail(item);
  });

  gridEl.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = cardFromEvent(event);
    if (!item) return;
    event.preventDefault();
    openDetail(item);
  });

  // ---------- Detay penceresi ----------
  function findOwned(item) {
    return ownedMap().get(item.tmdbType + ':' + item.tmdbId);
  }

  function openDetail(item) {
    current = item;
    currentDetails = null;
    const token = ++detailToken;
    const label = item.tmdbType === 'tv' ? 'Dizi' : 'Film';

    document.getElementById('detail-title').textContent = item.title;
    const original = item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : '';
    document.getElementById('detail-meta').textContent = [item.year, label, original].filter(Boolean).join(' · ');
    document.getElementById('detail-genres').textContent = '';
    document.getElementById('detail-vote').textContent = item.voteAverage ? `TMDB puanı: ${item.voteAverage.toFixed(1)} / 10` : '';
    document.getElementById('detail-overview').textContent = item.overview || 'Özet yok.';
    const posterEl = document.getElementById('detail-poster');
    posterEl.hidden = !item.poster;
    if (item.poster) posterEl.src = Tmdb.posterUrl(item.poster, 'w342');
    drawActions();
    document.getElementById('detail-director').textContent = '';
    imdbEl.textContent = '';
    trailerEl.innerHTML = '';
    trailer = null;
    similarItems = [];
    similarEl.innerHTML = '<p class="hint">Yükleniyor…</p>';
    castEl.innerHTML = '<p class="hint">Yükleniyor…</p>';
    watchEl.innerHTML = '<p class="hint">Yükleniyor…</p>';
    reviewsEl.innerHTML = '<p class="hint">Yorumlar yükleniyor…</p>';
    detailDialog.showModal();
    detailDialog.scrollTop = 0;
    // Dördü birbirini beklemeden çalışır; biri başarısız olsa da diğerleri gösterilir
    loadDetails(item, token);
    loadTrailer(item, token);
    loadSimilar(item, token);
    loadImdb(item, token);
    loadCast(item, token);
    loadWatch(item, token);
    loadReviews(item, token);
  }

  // Benzer yapımlar şeridi: TMDB önerilerinden afişi olan ilk 12'si; birine basınca onun detayı açılır
  async function loadSimilar(item, token) {
    try {
      const list = (await Tmdb.recommendations(item.tmdbType, item.tmdbId)).filter(other => other.poster).slice(0, 12);
      if (token !== detailToken) return;
      similarItems = list;
      const owned = ownedMap();
      similarEl.innerHTML = list.length
        ? `<ul class="similar-list">${list.map((other, index) => `
            <li>
              <button type="button" class="similar-item" data-index="${index}" aria-label="${escapeHtml(other.title)} ayrıntıları">
                <span class="poster" style="--hue:${titleHue(other.title)}">
                  <span class="poster-letter">${escapeHtml(other.title.charAt(0).toUpperCase())}</span>
                  <img class="poster-img" src="${Tmdb.posterUrl(other.poster, 'w185')}" alt="" loading="lazy">
                  ${owned.has(other.tmdbType + ':' + other.tmdbId) ? '<span class="owned-badge" title="Arşivinde var">✓</span>' : ''}
                </span>
                <strong class="similar-title">${escapeHtml(other.title)}</strong>
                <span class="similar-meta muted">${[other.year, other.voteAverage ? '★ ' + other.voteAverage.toFixed(1) : ''].filter(Boolean).join(' · ')}</span>
              </button>
            </li>`).join('')}</ul>`
        : '<p class="hint">Benzer yapım bulunamadı.</p>';
    } catch (error) {
      if (token !== detailToken) return;
      similarEl.innerHTML = `<p class="hint error">Benzer yapımlar getirilemedi. ${escapeHtml(tmdbErrorMessage(error))}</p>`;
    }
  }

  similarEl.addEventListener('click', event => {
    const button = event.target.closest('.similar-item');
    if (button && similarItems[button.dataset.index]) openDetail(similarItems[button.dataset.index]);
  });

  similarEl.addEventListener('error', event => {
    if (event.target.classList.contains('poster-img')) event.target.remove();
  }, true);

  // Fragman bulunursa "Fragmanı izle" düğmesi çıkar; bulunamazsa hiçbir şey gösterilmez
  async function loadTrailer(item, token) {
    try {
      const found = await Tmdb.trailer(item.tmdbType, item.tmdbId);
      if (token !== detailToken || !found) return;
      trailer = found;
      trailerEl.innerHTML = '<button type="button" class="btn trailer-btn">▶ Fragmanı izle</button>';
    } catch {
      // fragman gelmezse bu bölüm boş kalır
    }
  }

  // 184203 -> "184.203", 2516752 -> "2,5 milyon"
  function formatVotes(count) {
    return count >= 1e6
      ? `${(count / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} milyon`
      : count.toLocaleString('tr-TR');
  }

  // IMDb puanı: önce TMDB'den IMDb numarası, sonra OMDb'den puan. Anahtar yoksa sadece IMDb bağlantısı gösterilir.
  async function loadImdb(item, token) {
    let imdbId = '';
    try {
      imdbId = await Tmdb.imdbId(item.tmdbType, item.tmdbId);
    } catch {
      // IMDb numarası gelmezse bu satır boş kalır
    }
    if (token !== detailToken || !imdbId) return;

    const url = `https://www.imdb.com/title/${imdbId}/`;
    const link = text => `<a class="watch-link" href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    if (!Omdb.isReady()) {
      imdbEl.innerHTML = `${link("IMDb'de aç ↗")} <span class="muted">· puanı görmek için ⚙ Ayarlar'a OMDb anahtarı ekle</span>`;
      return;
    }

    try {
      const imdb = await Omdb.rating(imdbId);
      if (token !== detailToken) return;
      imdbEl.innerHTML = imdb
        ? `${link(`IMDb puanı: <strong>${imdb.rating.toFixed(1)}</strong> / 10`)} <span class="muted">(${formatVotes(imdb.votes)} oy)</span>`
        : `${link("IMDb'de aç ↗")} <span class="muted">· IMDb'de henüz puan yok</span>`;
    } catch (error) {
      if (token !== detailToken) return;
      imdbEl.innerHTML = `${link("IMDb'de aç ↗")} <span class="hint error">IMDb puanı alınamadı. ${escapeHtml(omdbErrorMessage(error))}</span>`;
    }
  }

  // Oyuncular ve yönetmen
  async function loadCast(item, token) {
    try {
      const { cast, directors } = await Tmdb.credits(item.tmdbType, item.tmdbId);
      if (token !== detailToken) return;
      document.getElementById('detail-director').textContent = directors.length ? `Yönetmen: ${directors.join(', ')}` : '';
      castEl.innerHTML = cast.length
        ? `<ul class="cast-list">${cast.map(person => `
            <li class="cast-person">
              <span class="cast-photo" style="--hue:${titleHue(person.name)}">
                <span>${escapeHtml(person.name.charAt(0).toUpperCase())}</span>
                ${person.photo ? `<img src="${person.photo}" alt="" loading="lazy">` : ''}
              </span>
              <strong class="cast-name">${escapeHtml(person.name)}</strong>
              ${person.character ? `<span class="cast-role">${escapeHtml(person.character)}</span>` : ''}
            </li>`).join('')}</ul>`
        : '<p class="hint">Oyuncu bilgisi bulunamadı.</p>';
    } catch (error) {
      if (token !== detailToken) return;
      castEl.innerHTML = `<p class="hint error">Oyuncular getirilemedi. ${escapeHtml(tmdbErrorMessage(error))}</p>`;
    }
  }

  // Kategoriler ve özet
  async function loadDetails(item, token) {
    try {
      const details = await Tmdb.details(item.tmdbType, item.tmdbId);
      if (token !== detailToken) return;
      currentDetails = details;
      document.getElementById('detail-genres').textContent = details.genres.join(', ');
      if (details.overview) document.getElementById('detail-overview').textContent = details.overview;
    } catch {
      // ayrıntılar gelmezse liste bilgileri yeterli
    }
  }

  // Nereden izlenir? (Türkiye'deki platformlar)
  async function loadWatch(item, token) {
    try {
      const watch = await Tmdb.watchProviders(item.tmdbType, item.tmdbId);
      if (token !== detailToken) return;
      if (!watch.groups.length) {
        watchEl.innerHTML = "<p class=\"hint\">Türkiye'de şu an bir platformda görünmüyor.</p>";
        return;
      }
      watchEl.innerHTML = watch.groups.map(group => `
        <div class="watch-group">
          <span class="watch-label">${group.label}</span>
          <ul class="providers">
            ${group.providers.map(provider => `
              <li class="provider" title="${escapeHtml(provider.name)}">
                ${provider.logo ? `<img src="${provider.logo}" alt="" loading="lazy">` : ''}
                <span>${escapeHtml(provider.name)}</span>
              </li>`).join('')}
          </ul>
        </div>`).join('') +
        (watch.link.startsWith('https://') ? `<a class="watch-link" href="${escapeHtml(watch.link)}" target="_blank" rel="noopener noreferrer">Tüm seçenekleri TMDB'de gör ↗</a>` : '');
    } catch (error) {
      if (token !== detailToken) return;
      watchEl.innerHTML = `<p class="hint error">Platform bilgisi getirilemedi. ${escapeHtml(tmdbErrorMessage(error))}</p>`;
    }
  }

  // Dünyadan yorumlar
  async function loadReviews(item, token) {
    try {
      const reviews = await Tmdb.reviews(item.tmdbType, item.tmdbId);
      if (token !== detailToken) return;
      currentReviews = reviews.slice(0, 10);
      reviewsEl.innerHTML = currentReviews.length
        ? currentReviews.map(reviewHtml).join('')
        : '<p class="hint">Bu yapım için henüz yorum yazılmamış.</p>';
    } catch (error) {
      if (token !== detailToken) return;
      reviewsEl.innerHTML = `<p class="hint error">Yorumlar getirilemedi. ${escapeHtml(tmdbErrorMessage(error))}</p>`;
    }
  }

  function reviewHtml(review, index) {
    const long = review.content.length > 400;
    const text = long ? review.content.slice(0, 400).trimEnd() + '…' : review.content;
    return `
      <article class="review">
        <p class="review-head">
          <strong>${escapeHtml(review.author)}</strong>
          ${review.rating ? `<span class="review-rating">★ ${review.rating} / 10</span>` : ''}
          ${review.date ? `<span class="muted">${escapeHtml(formatDate(review.date))}</span>` : ''}
        </p>
        <p class="review-text">${escapeHtml(text)}</p>
        ${long ? `<button type="button" class="btn btn-small review-more" data-index="${index}">Devamını oku</button>` : ''}
      </article>`;
  }

  // "Devamını oku": kısaltılmış yorumu tamamıyla değiştir
  reviewsEl.addEventListener('click', event => {
    const button = event.target.closest('.review-more');
    if (!button) return;
    button.closest('.review').querySelector('.review-text').textContent = currentReviews[button.dataset.index].content;
    button.remove();
  });

  // Arşivde varsa durumunu göster, yoksa ekleme düğmelerini
  function drawActions() {
    const entry = findOwned(current);
    if (entry) {
      const where = entry.status === 'izledim' ? 'İzlediklerin arasında' : 'İzleme listende';
      actionsEl.innerHTML = `
        <span class="hint ok">✓ ${where}</span>
        <button type="button" class="btn" data-act="edit">Arşivde düzenle</button>`;
    } else {
      actionsEl.innerHTML = `
        <button type="button" class="btn btn-primary" data-act="watched">İzledim olarak ekle</button>
        <button type="button" class="btn" data-act="watchlist">İzleme listeme ekle</button>`;
    }
  }

  // Ekleme / düzenleme, normal form penceresinde açılır (puan ve yorum da girilebilsin)
  actionsEl.addEventListener('click', event => {
    const button = event.target.closest('button[data-act]');
    if (!button) return;

    const entry = findOwned(current);
    closeDetail();
    if (button.dataset.act === 'edit' && entry) return openForm(entry);

    const watched = button.dataset.act === 'watched';
    openForm({
      title: current.title,
      type: current.tmdbType === 'tv' ? 'dizi' : 'film',
      year: current.year,
      status: watched ? 'izledim' : 'izlenecek',
      rating: 0,
      watchedDate: watched ? today() : '',
      review: '',
      tmdbId: current.tmdbId,
      tmdbType: current.tmdbType,
      poster: currentDetails?.poster || current.poster,
      overview: currentDetails?.overview || current.overview,
      genres: currentDetails?.genres || []
    });
  });

  document.getElementById('detail-close').addEventListener('click', closeDetail);
  detailDialog.addEventListener('click', event => {
    if (event.target === detailDialog) closeDetail();
  });
  document.getElementById('detail-poster').addEventListener('error', event => { event.target.hidden = true; });

  // ---------- app.js'nin kullandığı fonksiyonlar ----------
  return {
    show() {
      section.hidden = false;
      if (!state.loaded) {
        state.loaded = true;
        loadOptions();
        reload();
      } else {
        draw(); // arşive bir şey eklendiyse "✓" işaretleri güncellensin
      }
    },
    hide() {
      section.hidden = true;
    },
    // Arşivdeki bir kart da aynı detay penceresini açabilsin (TMDB'den eklenmişse)
    openDetail
  };
})();
