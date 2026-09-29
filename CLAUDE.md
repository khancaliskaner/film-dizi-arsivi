# Proje: Kişisel Film & Dizi Arşivi (Letterboxd tarzı)

## Ben kimim, nasıl çalışalım
- Vibe coding ile kendimi geliştiriyorum. Programcı değilim, iki yıllık elektrik okuyan bir öğrenciyim.
- Daha önce sıfırdan bir besin takip uygulaması yaptım. Bu proje ondan bir seviye daha ileri olsun ama beni boğmasın.
- Bu uygulamayı sadece ben kullanacağım (kişisel arşiv).
- Açıklamaları Türkçe yap, sade anlat. Teknik terim kullanırsan bir cümleyle ne olduğunu söyle.

## Çalışma kuralları (önemli)
1. Aşama aşama ilerle. Ben "sonraki aşamaya geç" demeden bir sonraki aşamaya başlama.
2. Her aşama sonunda uygulama çalışır durumda olsun. Yarım bırakılmış özellik olmasın.
3. Bir şey yapmadan önce kısaca ne yapacağını söyle, yaptıktan sonra hangi dosyaları değiştirdiğini ve uygulamayı nasıl çalıştıracağımı yaz.
4. Kod basit ve okunaklı olsun. Gereksiz karmaşıklık, gereksiz kütüphane ekleme. Her dosyanın en üstüne ne işe yaradığını tek satır yorumla yaz.
5. Bir hata çıkarsa sebebini basitçe açıkla, sonra düzelt.
6. Büyük bir değişiklik yapmadan (dosya yapısını değiştirmek, yeni kütüphane eklemek gibi) önce bana sor.
7. Her aşama sonunda bir git commit önerisi ver (kısa, Türkçe mesaj).

## Uygulama nedir
Letterboxd'dan ilham alan kişisel bir film ve dizi arşivi. İzlediklerimi kaydediyorum, puanlıyorum, kısa yorum yazıyorum, izlemek istediklerimi listeliyorum. Görünüm afiş odaklı, koyu temalı, sade ve şık olsun.

Kapsam: sadece film ve dizi (kitap yok).

## Teknoloji
- Sade HTML, CSS ve JavaScript. Framework kullanma (React vb. yok).
- Veriler tarayıcıda localStorage içinde saklansın. Veri işlemleri tek bir dosyada toplansın ki ileride başka bir yere taşımak kolay olsun.
- Telefonda da düzgün görünmeli (mobil uyumlu).
- Bir arayüz dili: Türkçe.

## Aşamalar

### Aşama 1: Temel arşiv (elle ekleme)
- Ekleme formu: başlık, tür (film / dizi), yıl, puan, kısa yorum, izleme tarihi, durum (izledim / izlemek istiyorum).
- Puan: yarım yıldızlı 5 yıldız sistemi (0.5 ile 5 arası), Letterboxd gibi.
- Eklenenler kart olarak listelensin. Kartı düzenleme ve silme (silmeden önce onay) olsun.
- Sayfalar: Ana sayfa (son izlenenler), İzlediklerim, İzleme Listem.

### Aşama 2: Arama, filtre, sıralama
- İsme göre arama.
- Filtre: tür, puan, durum, yıl.
- Sıralama: en yüksek puan, en yeni izlenen, alfabetik.

### Aşama 3: Afiş ve bilgileri otomatik getirme (TMDB)
- Başlık yazınca TMDB'den arama sonuçları çıksın; seçince afiş, yıl, özet ve tür otomatik dolsun.
- TMDB API anahtarını koda gömme. Ayrı bir ayar dosyasında tut ve o dosyayı .gitignore'a ekle. Anahtarı nasıl alacağımı adım adım anlat.
- İnternet yoksa veya API çalışmazsa uygulama hata vermesin, elle ekleme çalışmaya devam etsin.
- Aşama 1-2'de eklediğim kayıtlar bozulmasın.

### Aşama 4: Günlük (diary) ve istatistik
- Günlük sayfası: izleme tarihine göre ay ay liste.
- İstatistik sayfası: bu yıl kaç film/dizi izledim, ortalama puanım, en çok izlediğim tür, aylık izleme grafiği, verdiğim puan dağılımı (kaç tane 5 yıldız, kaç tane 4 yıldız gibi).

### Aşama 5: Listeler ve favoriler
- Kendi özel listelerimi oluşturabileyim (ör. "Hafta sonu filmleri", "Tekrar izlerim").
- Favori 4 filmimi profil sayfasında göstereyim (Letterboxd'daki gibi).
- Kalp (beğen) işareti.

### Aşama 6 (isteğe bağlı): Yedekleme ve paylaşım
- Verilerimi JSON dosyası olarak dışa/içe aktarma.
- İstersem "bu yıl izlediklerim" sayfasını link ile paylaşma yolunu birlikte konuşalım.

## Tasarım isteği
- Koyu tema, afişler öne çıksın, ızgara (grid) düzeni.
- Fazla süslü olmasın, temiz ve okunaklı olsun.
- Yıldızlar ve butonlar telefonda parmakla rahat basılabilsin.

## Şimdi yapılacak
Sadece Aşama 1'i yap. Başlamadan önce dosya yapısını (hangi dosyalar olacak) bana kısaca göster ve onayımı bekle.
