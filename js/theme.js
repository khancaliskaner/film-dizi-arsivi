// Renk paleti: vurgu rengi ve zemin tonunu ayarlardan okuyup sayfaya uygular; Ayarlar'daki renk seçicileri de burada.
// Bu dosya <head> içinde yüklenir ki sayfa açılırken eski renk bir an görünüp yanıp sönmesin.

const Theme = (() => {
  // Her palet, CSS'teki renk değişkenlerini (--accent gibi) değiştirir.
  // accent: düğme ve dolgu rengi, text: koyu zeminde yazı/yıldız olarak kullanılan daha açık ton, on: düğmenin üstündeki yazı.
  const ACCENTS = {
    yesil:   { name: 'Yeşil',    accent: '#00c030', hover: '#00a828', text: '#00c030', on: '#ffffff' },
    mavi:    { name: 'Mavi',     accent: '#2f6fed', hover: '#2459c9', text: '#6ea1ff', on: '#ffffff' },
    mor:     { name: 'Mor',      accent: '#7c4dff', hover: '#6a3de8', text: '#a78bfa', on: '#ffffff' },
    pembe:   { name: 'Pembe',    accent: '#d02c74', hover: '#b8256a', text: '#ff7ab0', on: '#ffffff' },
    turuncu: { name: 'Turuncu',  accent: '#cc4a06', hover: '#b34105', text: '#ff9a55', on: '#ffffff' },
    kirmizi: { name: 'Kırmızı',  accent: '#d93a3a', hover: '#c02f2f', text: '#ff7b7b', on: '#ffffff' },
    altin:   { name: 'Altın',    accent: '#e5b800', hover: '#cca500', text: '#f5cd3d', on: '#1a1400' }
  };

  const BACKGROUNDS = {
    klasik: { name: 'Klasik',      bg: '#14181c', surface: '#1c2228', surface2: '#2c3440', border: '#2f3842' },
    gece:   { name: 'Gece mavisi', bg: '#0f1420', surface: '#172033', surface2: '#25324a', border: '#2a3854' },
    amoled: { name: 'Amoled',      bg: '#000000', surface: '#0d0d0d', surface2: '#1e1e1e', border: '#2a2a2a' },
    sicak:  { name: 'Sıcak',       bg: '#1a1613', surface: '#231e1a', surface2: '#352d27', border: '#3d342d' }
  };

  const DEFAULTS = { accent: 'yesil', bg: 'klasik' };

  function saved() {
    const theme = Storage.getSetting('theme') || {};
    return {
      accent: ACCENTS[theme.accent] ? theme.accent : DEFAULTS.accent,
      bg: BACKGROUNDS[theme.bg] ? theme.bg : DEFAULTS.bg
    };
  }

  // Seçilen renkleri CSS değişkenlerine yazar; telefondaki tarayıcı çubuğunun rengini de günceller
  function apply({ accent, bg }) {
    const a = ACCENTS[accent];
    const b = BACKGROUNDS[bg];
    const root = document.documentElement.style;
    root.setProperty('--accent', a.accent);
    root.setProperty('--accent-hover', a.hover);
    root.setProperty('--accent-text', a.text);
    root.setProperty('--on-accent', a.on);
    root.setProperty('--bg', b.bg);
    root.setProperty('--surface', b.surface);
    root.setProperty('--surface-2', b.surface2);
    root.setProperty('--border', b.border);

    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', b.bg);
  }

  function set(part, id) {
    const theme = { ...saved(), [part]: id };
    Storage.setSetting('theme', theme);
    apply(theme);
    drawPickers();
  }

  // ---------- Ayarlar penceresindeki seçiciler ----------
  function drawPickers() {
    const current = saved();
    const accentBox = document.getElementById('accent-swatches');
    const bgBox = document.getElementById('bg-swatches');
    if (!accentBox || !bgBox) return;

    accentBox.innerHTML = Object.entries(ACCENTS).map(([id, a]) => `
      <button type="button" class="swatch" data-accent="${id}" style="--swatch:${a.accent}"
              aria-pressed="${id === current.accent}" aria-label="${a.name}" title="${a.name}"></button>`).join('');

    bgBox.innerHTML = Object.entries(BACKGROUNDS).map(([id, b]) => `
      <button type="button" class="bg-swatch" data-bg="${id}" style="--swatch-bg:${b.bg}; --swatch-surface:${b.surface}; --swatch-border:${b.border}"
              aria-pressed="${id === current.bg}">${b.name}</button>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    drawPickers();
    document.getElementById('accent-swatches').addEventListener('click', event => {
      const button = event.target.closest('[data-accent]');
      if (button) set('accent', button.dataset.accent);
    });
    document.getElementById('bg-swatches').addEventListener('click', event => {
      const button = event.target.closest('[data-bg]');
      if (button) set('bg', button.dataset.bg);
    });
    document.getElementById('theme-reset').addEventListener('click', () => {
      Storage.setSetting('theme', { ...DEFAULTS });
      apply(DEFAULTS);
      drawPickers();
    });
  });

  apply(saved()); // sayfa çizilmeden önce

  return { apply, saved };
})();
