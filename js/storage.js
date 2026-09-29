// Veri işlemleri: kayıtları, özel listeleri, favorileri ve ayarları tarayıcının localStorage'ında saklar, okur, günceller ve siler.
// Verileri ileride başka bir yere taşımak istersek sadece bu dosyayı değiştirmek yeterli.

const STORAGE_KEY = 'arsiv_kayitlar';
const SETTINGS_KEY = 'arsiv_ayarlar';
const LISTS_KEY = 'arsiv_listeler';
const FAVORITES_KEY = 'arsiv_favoriler';

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
