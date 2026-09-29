// Uygulama olarak kurma: servis çalışanını kaydeder, "Uygulamayı kur" düğmesini yönetir ve internet kesilince uyarı çubuğunu gösterir.

const Pwa = (() => {
  const installText = document.getElementById('install-text');
  const installBtn = document.getElementById('install-btn');
  const offlineBar = document.getElementById('offline-bar');
  let installEvent = null; // tarayıcının "kurulabilir" dediği an verdiği olay (Chrome/Edge/Android)

  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Servis çalışanı sadece https (veya localhost) üzerinde çalışır; bilgisayardaki dosyada kayıt denenmez
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // kayıt olmazsa uygulama yine normal çalışır, sadece çevrimdışı desteği olmaz
    });
  }

  // ---------- Kurulum ----------
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); // tarayıcının kendi küçük önerisi yerine Ayarlar'daki düğmeyi kullanıyoruz
    installEvent = event;
    refresh();
  });

  window.addEventListener('appinstalled', () => {
    installEvent = null;
    refresh();
  });

  installBtn.addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null; // her olay bir kez kullanılabilir
    refresh();
  });

  // Ayarlar penceresi açılırken durum metnini güncelle
  function refresh() {
    installBtn.hidden = !installEvent;
    if (isStandalone()) {
      installText.textContent = '✓ Uygulamayı zaten uygulama olarak kullanıyorsun. İnternet yokken de arşivin açılır.';
    } else if (installEvent) {
      installText.textContent = 'Ana ekrana kur: kendi simgesiyle, adres çubuğu olmadan açılır ve internet yokken de arşivin çalışır.';
    } else if (location.protocol === 'file:') {
      installText.textContent = 'Kurulum sadece canlı sitede çalışır (bilgisayardaki dosyada değil): khancaliskaner.github.io/film-dizi-arsivi';
    } else if (isIos()) {
      installText.textContent = "iPhone/iPad: Safari'de alttaki Paylaş simgesine bas, sonra \"Ana Ekrana Ekle\"yi seç.";
    } else {
      installText.textContent = 'Tarayıcı menüsünden "Uygulamayı yükle" veya "Ana ekrana ekle" seçeneğini kullanabilirsin. (Bazı tarayıcılarda bu seçenek, siteyi biraz kullandıktan sonra çıkar.)';
    }
  }

  // ---------- Çevrimdışı uyarısı ----------
  function updateOnline() {
    offlineBar.hidden = navigator.onLine;
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  return { refresh };
})();
