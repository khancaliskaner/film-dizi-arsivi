// Veri işlemleri: kayıtları, özel listeleri, favorileri ve ayarları tarayıcının localStorage'ında saklar, okur, günceller ve siler.
// Verileri ileride başka bir yere taşımak istersek sadece bu dosyayı değiştirmek yeterli.

const STORAGE_KEY = 'arsiv_kayitlar';
const SETTINGS_KEY = 'arsiv_ayarlar';
const LISTS_KEY = 'arsiv_listeler';
const FAVORITES_KEY = 'arsiv_favoriler';
const GOALS_KEY = 'arsiv_hedefler';

const BACKUP_APP = 'kaan-nis-secimleri';

// Yedek dosyasından gelen bir kaydı kontrol eder ve sadece bilinen alanları alır; geçersizse null döner.
function cleanItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id || typeof raw.title !== 'string' || !raw.title.trim()) return null;
  if (!['film', 'dizi'].includes(raw.type) || !['izledim', 'izlenecek'].includes(raw.status)) return null;

  const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
  const rating = Number(raw.rating);
  return {
    id: raw.id,
    title: raw.title.trim().slice(0, 150),
    type: raw.type,
    year: Number.isInteger(raw.year) ? raw.year : null,
    status: raw.status,
    rating: rating >= 0.5 && rating <= 5 && (rating * 2) % 1 === 0 ? rating : 0,
    watchedDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.watchedDate) ? raw.watchedDate : '',
    review: text(raw.review, 1000),
    liked: raw.liked === true,
    tmdbId: Number.isInteger(raw.tmdbId) ? raw.tmdbId : null,
    tmdbType: ['movie', 'tv'].includes(raw.tmdbType) ? raw.tmdbType : '',
    poster: /^\/[\w.-]+$/.test(raw.poster) ? raw.poster : '',
    overview: text(raw.overview, 3000),
    genres: Array.isArray(raw.genres) ? raw.genres.filter(genre => typeof genre === 'string').slice(0, 10) : [],
    createdAt: text(raw.createdAt, 40) || new Date().toISOString(),
    ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt.slice(0, 40) } : {})
  };
}

// Yıllık hedefleri kontrol eder: yıl 1900-2200, sayı 1-9999, tür hepsi/film/dizi; geçersizler atılır.
function cleanGoals(raw) {
  const goals = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return goals;
  for (const [year, goal] of Object.entries(raw)) {
    const count = Number(goal?.count);
    if (/^\d{4}$/.test(year) && year >= 1900 && year <= 2200 && Number.isInteger(count) && count >= 1 && count <= 9999) {
      goals[year] = { count, type: ['film', 'dizi'].includes(goal.type) ? goal.type : 'hepsi' };
    }
  }
  return goals;
}

// Aynısı özel listeler için.
function cleanList(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    id: raw.id,
    name: raw.name.trim().slice(0, 60),
    itemIds: Array.isArray(raw.itemIds) ? raw.itemIds.filter(id => typeof id === 'string') : [],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : ''
  };
}

const Storage = {
  // Bütün kayıtları dizi olarak döndürür. Veri bozuksa boş dizi döner.
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  },

  saveAll(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  },

  getById(id) {
    return this.getAll().find(item => item.id === id);
  },

  // Yeni kayıt ekler, eklenen kaydı döndürür.
  add(data) {
    const items = this.getAll();
    const item = {
      ...data,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString()
    };
    items.push(item);
    this.saveAll(items);
    return item;
  },

  update(id, data) {
    const items = this.getAll().map(item =>
      item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
    );
    this.saveAll(items);
  },

  // Kaydı siler; özel listelerden ve favorilerden de çıkarır.
  remove(id) {
    this.saveAll(this.getAll().filter(item => item.id !== id));
    this.saveLists(this.getLists().map(list => ({ ...list, itemIds: list.itemIds.filter(itemId => itemId !== id) })));
    this.saveFavorites(this.getFavorites().map(favoriteId => (favoriteId === id ? null : favoriteId)));
  },

  // ---------- Özel listeler (ör. "Hafta sonu filmleri") ----------
  getLists() {
    try {
      return JSON.parse(localStorage.getItem(LISTS_KEY)) || [];
    } catch {
      return [];
    }
  },

  saveLists(lists) {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  },

  getListById(id) {
    return this.getLists().find(list => list.id === id);
  },

  addList(name) {
    const list = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      itemIds: [],
      createdAt: new Date().toISOString()
    };
    this.saveLists([...this.getLists(), list]);
    return list;
  },

  renameList(id, name) {
    this.saveLists(this.getLists().map(list => (list.id === id ? { ...list, name } : list)));
  },

  removeList(id) {
    this.saveLists(this.getLists().filter(list => list.id !== id));
  },

  // Kayıt listedeyse çıkarır, değilse ekler. Sonucu (artık listede mi) döndürür.
  toggleInList(listId, itemId) {
    let inList = false;
    this.saveLists(this.getLists().map(list => {
      if (list.id !== listId) return list;
      inList = !list.itemIds.includes(itemId);
      const itemIds = inList ? [...list.itemIds, itemId] : list.itemIds.filter(id => id !== itemId);
      return { ...list, itemIds };
    }));
    return inList;
  },

  // ---------- Favori 4 (profil sayfası) ----------
  // Her zaman 4 elemanlı bir dizi: kayıt id'si ya da boş kutu için null.
  getFavorites() {
    let ids;
    try {
      ids = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    } catch {
      ids = null;
    }
    return Array.from({ length: 4 }, (_, index) => (Array.isArray(ids) && ids[index]) || null);
  },

  saveFavorites(ids) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  },

  // slot: 0-3. itemId null ise kutuyu boşaltır. Aynı yapım başka kutudaysa oradan taşınır.
  setFavorite(slot, itemId) {
    const ids = this.getFavorites().map(id => (id === itemId ? null : id));
    ids[slot] = itemId;
    this.saveFavorites(ids);
  },

  // ---------- Yıllık hedefler ({ "2026": { count: 100, type: "hepsi" | "film" | "dizi" } }) ----------
  getGoals() {
    try {
      return cleanGoals(JSON.parse(localStorage.getItem(GOALS_KEY)));
    } catch {
      return {};
    }
  },

  getGoal(year) {
    return this.getGoals()[String(year)] || null;
  },

  // goal null verilirse o yılın hedefi silinir
  setGoal(year, goal) {
    const goals = this.getGoals();
    if (goal) goals[String(year)] = goal;
    else delete goals[String(year)];
    localStorage.setItem(GOALS_KEY, JSON.stringify(cleanGoals(goals)));
  },

  // ---------- Yedekleme (JSON dışa / içe aktarma) ----------
  // Kayıtlar, listeler ve favoriler yedeğe girer. Ayarlar (TMDB anahtarı) girmez.
  exportAll() {
    return {
      app: BACKUP_APP,
      version: 1,
      exportedAt: new Date().toISOString(),
      items: this.getAll(),
      lists: this.getLists(),
      favorites: this.getFavorites(),
      goals: this.getGoals()
    };
  },

  // Yedek dosyasının içeriğini kontrol edip temizler; henüz hiçbir şeyi kaydetmez.
  // Geçersiz kayıtlar atlanır. Dosya bir yedek değilse hata fırlatır.
  parseBackup(data) {
    if (!data || data.app !== BACKUP_APP || !Array.isArray(data.items)) {
      throw new Error('Bu dosya bir arşiv yedeği gibi görünmüyor.');
    }
    const items = data.items.map(cleanItem).filter(Boolean);
    if (data.items.length && !items.length) throw new Error('Yedekteki kayıtlar okunamadı.');
    const lists = (Array.isArray(data.lists) ? data.lists : []).map(cleanList).filter(Boolean);
    const favorites = Array.from({ length: 4 }, (_, index) => {
      const id = Array.isArray(data.favorites) ? data.favorites[index] : null;
      return typeof id === 'string' ? id : null;
    });
    // Eski yedeklerde "goals" yoktur; o zaman boş sayılır
    return { items, lists, favorites, goals: cleanGoals(data.goals), skipped: data.items.length - items.length };
  },

  // parseBackup'tan gelen veriyi kaydeder. mode: 'merge' (mevcutlar korunur, aynı id'liler yedektekiyle güncellenir)
  // ya da 'replace' (mevcut her şey silinir, yerine yedek gelir).
  importParsed(parsed, mode) {
    const merge = mode === 'merge';

    const items = new Map(merge ? this.getAll().map(item => [item.id, item]) : []);
    for (const item of parsed.items) items.set(item.id, item);

    const lists = new Map(merge ? this.getLists().map(list => [list.id, list]) : []);
    for (const list of parsed.lists) lists.set(list.id, list);

    // Listelerde ve favorilerde artık var olmayan kayıtlara işaret eden id kalmasın
    const exists = id => items.has(id);
    const cleanLists = [...lists.values()].map(list => ({ ...list, itemIds: list.itemIds.filter(exists) }));

    // Favoriler yedekteki kutusuna yerleşir; o kutu doluysa (birleştirmede) ilk boş kutuya
    const favorites = merge ? this.getFavorites() : [null, null, null, null];
    parsed.favorites.forEach((id, index) => {
      if (!id || !exists(id) || favorites.includes(id)) return;
      const slot = favorites[index] === null ? index : favorites.indexOf(null);
      if (slot !== -1) favorites[slot] = id;
    });

    // Hedefler: birleştirmede aynı yılın hedefi yedektekiyle güncellenir, değiştirmede yedektekiler kalır
    const goals = { ...(merge ? this.getGoals() : {}), ...parsed.goals };
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));

    this.saveAll([...items.values()]);
    this.saveLists(cleanLists);
    this.saveFavorites(favorites.map(id => (id && exists(id) ? id : null)));
  },

  // ---------- Ayarlar (ör. TMDB anahtarı) ----------
  getSetting(name) {
    try {
      return (JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {})[name];
    } catch {
      return undefined;
    }
  },

  setSetting(name, value) {
    let settings;
    try {
      settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch {
      settings = {};
    }
    settings[name] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};
