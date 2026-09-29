// Veri işlemleri: kayıtları tarayıcının localStorage'ında saklar, okur, günceller ve siler.
// Verileri ileride başka bir yere taşımak istersek sadece bu dosyayı değiştirmek yeterli.

const STORAGE_KEY = 'arsiv_kayitlar';
const SETTINGS_KEY = 'arsiv_ayarlar';

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

  remove(id) {
    this.saveAll(this.getAll().filter(item => item.id !== id));
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
