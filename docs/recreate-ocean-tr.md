# Ocean Shader Lab için Bunu kendin yap prompt paketi

Durum: Kullanıcıya yönelik taslak. Henüz portföye entegre edilmedi veya yayımlanmadı.

Bu rehber, tarayıcıda çalışan özgün bir kıyı dioraması üretmek isteyenler için. Three.js, TypeScript ve GLSL ile şeffaf mavi suyu, su altındaki zemini, önden görünen kesiti ve sıcak tonlu kayaları birlikte kurmayı anlatıyor. Ana promptu bir kodlama ajanına ver; sonraki promptları çıkan görüntüye göre kullan.

İyi sonuç için önce kadrajı ve büyük kütleleri çöz, sonra suyu ve küçük ayrıntıları geliştir. Her turda aynı kamera ve ışıkla ekran görüntüsü al. Bu paket bir başlangıç tarifi ve görsel değerlendirme yöntemi sunuyor; tek seferde aynı görüntüyü üretme garantisi vermiyor.

## Mevcut örneğin kapsamı

Ocean Shader Lab'in mevcut sahnesinde kıyı kesiti, şeffaf mavi su, sıcak tonlu parçalı kayalar, kum ve bitki örtüsü var. Kamerayı döndürme, başlangıç görünümüne dönme, animasyonu duraklatma, azaltılmış hareket ve farklı ekranlara uyarlanan kontroller bulunuyor.

M3 Max üzerinde yapılan mevcut kontrollerde masaüstü görünümünde yaklaşık 60 FPS, mobil boyutlu tarayıcı görünümünde yaklaşık 30 FPS gözlendi. Mobil görünüm testi fiziksel telefon testi değildir. Bu değerler her cihaz için performans garantisi sayılmaz.

Aşağıdaki tarif yeni bir uygulama üretmek için yazıldı. Önerilen test düzeni ve dosya organizasyonu, mevcut deponun birebir açıklaması olarak okunmamalı. Yaşayan Koy bölümünde özgün Ege kıyısı, küçük bir balık sürüsü ve deniz çayırı için ilk sürüm promptu; piknik yapan aile için ayrı bir sonraki aşama promptu var. Bu yeni sahneler mevcut Ocean Shader Lab sürümünün tamamlanmış özellikleri değiller.

## Başlamadan önce

- Üzerinde çalışılabilecek proje klasörünü aç veya boş bir proje alanı seç
- Varsa kullanım hakkına sahip olduğun bir görsel referans ekle; yoksa ana prompttaki kompozisyon yeterli
- Mevcut projeyi sürdürüyorsan paket dosyasını, kilit dosyasını ve çalıştırma yönergelerini ajana okut
- Referanstaki logo, imza ve ayırt edici varlıkları yeniden üretmesini isteme; kendi kıyı çizgini, kaya siluetlerini ve bitki dağılımını oluştur
- Kurulum ve çalıştırma komutlarını depodaki gerçek scriptlerden doğrulat; henüz kontrol edilmemiş paket sürümlerini veya komutları tahmin ettirme

## Ana prompt

Aşağıdaki metni bütünüyle kopyalayabilirsin.

```text
Three.js, TypeScript ve GLSL ile tarayıcıda çalışan özgün bir kıyı dioraması geliştir. Sonuç küçük bir kıyı parçasının üç boyutlu maketi gibi görünmeli. Şeffaf mavi su, su altında görünen kumlu zemin, önden okunabilen su kesiti, sıcak tonlu kırıklı kayalar ve seyrek bitkiler sahnenin temelini oluştursun.

Önce çalışma alanını incele. Mevcut proje varsa onun paket yöneticisini, kilit dosyasını ve mimarisini koru. Boş proje varsa küçük bir TypeScript ve Three.js uygulaması kur; gerekli araçları seçerken güncel resmi dokümantasyonu kontrol et. Bu çalışma için backend, hesap sistemi veya ücretli servis ekleme. Çalıştırmadığın komutu başarılı sayma. Dosya ve bağımlılık sürümü uydurma. Yayınlama veya deploy yapma.

Görsel hedef

1. İlk açılışta üç çeyrek açıdan, hafif yukarıdan bakılan tek bir diorama göster. Ön kesit ve suyun üst yüzeyi aynı anda görülsün. Ön yüzü aşırı sığ bir açıyla kaybetme. Ortografik veya düşük perspektifli kamera seçeneklerinden maket hissini en iyi vereni seç ve nedenini kısaca açıkla.
2. Su kadrajın ana öğesi olsun. Kayalık kıyı sahnenin arka ve bir yan bölümünde yükselsin; karşı tarafta suyun ve tabanın okunabildiği boşluk kalsın. Kıyı çizgisi asimetrik ve hafif kıvrımlı olsun. Tekdüze bir dikdörtgen havuz görünümünden kaçın.
3. Sahne çerçeveye değmesin. Kesit tabanının tamamı ve kaya tepeleri ilk kadrajda görünsün. Dışarıdaki boş alan sakin, açık nötr renkli olsun. UI sahnenin odak noktasını örtmesin.
4. Bir referans görsel varsa ondan kamera yüksekliği, renk dengesi, büyük kütle oranları ve su derinliğinin okunurluğu için yararlan. Aynı kaya dizilimini, nesneleri veya ayırt edici kompozisyonu birebir kopyalama. Özgün bir yorum üret.

Geometri

5. Kara, deniz tabanı, su yüzeyi ve öndeki kesit yüzünü ayrı sorumluluklara sahip geometri parçaları olarak kur. Kesit tabanının görünen kenarları kapalı ve tutarlı olsun; zeminin altı kameranın olağan hareketlerinde boş görünmesin.
6. Kumlu taban kıyıda yükselsin, açık suya doğru alçalsın. Su yüzeyi ve taban yüksekliği aynı koordinat sistemiyle hesaplanmalı. Kum, kayalar ve suyun birleştiği yerlerde boşluk veya titreşen üst üste yüzeyler bırakma.
7. Kayaları üst üste dizilmiş eş boyutlu kürelerle kurma. Birkaç büyük, yönlü kırılma yüzeyi olan kütle; bunların yanında orta boy parçalar ve az sayıda küçük taş kullan. Siluet, yükseklik, eğim ve renklerde kontrollü çeşitlilik oluştur. Büyük kayalar hacmi taşısın; küçük taşlar görsel gürültüye dönüşmesin.
8. Kaya renkleri sıcak gri, kum beji ve hafif pas tonları arasında kalsın. Gölge yüzleri biçimi anlatsın. Bitkileri az sayıda doğal kümeye yerleştir. Kum yüzeyine düşük kontrastlı, ölçeği tutarlı bir ayrıntı ekle. Prosedürel dağılımlar aynı seed ile tekrar üretilebilsin.

Su ve ışık

9. Su yüzeyini yalnızca düz mavi ve düşük opaklıklı bir plane olarak bırakma. Düşük genlikli büyük dalgaları ince normal ayrıntısıyla birleştir. Hareket sakin olsun; kıyı maketinin ölçeğine göre fazla büyük dalgalar üretme.
10. Sığ bölgelerde açık turkuaz, derinde daha doygun mavi bir geçiş kur. Renk ve saydamlık, mümkün olduğunca su sütununun kalınlığı veya taban derinliğiyle ilişkili olsun. Sadece ekran koordinatına göre boyanmış bir gradyanı fiziksel derinlik hesabı diye sunma.
11. Bakış açısına bağlı yansıma için ölçülü bir Fresnel yaklaşımı kullan. Tepe ışıkları küçük ve kontrollü olsun; suyu beyaz bir aynaya çevirmesin. Su altındaki kum ve kayalar ön ve üst açıdan seçilebilsin.
12. Kırılma, kıyı köpüğü veya su altı ışık desenleri ekleyeceksen bunları okunurluğa hizmet ettiği ölçüde kullan. Gerçek bir simülasyon yapmıyorsan prosedürel görsel yaklaşım olduğunu belgele. İlk çalışan sürüm bu ek efektlere bağlı olmasın.
13. Üst su yüzeyiyle ön kesit aynı su seviyesinde birleşsin. Hareket eden üst kenar ile kesit arasında çatlak oluşmasın. Kesit önünde yapay cam kalınlığı veya çerçeve zorunlu değil; suyun hacmi ve taban derinliği okunmalı.
14. Saydam nesnelerin çizim sırasını, derinlik testini ve derinlik yazımını bilinçli kur. Tüm malzemelere aynı ayarı vermek yerine yüzeylerin ilişkisine göre karar ver. Başlangıç kadrajı yanında sağ, sol ve daha alçak kamera açılarında da görünürlük hatalarını kontrol et.
15. Tek, tutarlı bir ana ışık yönü kullan. Kayadaki gölge, su parlaması ve genel renk sıcaklığı birbirini desteklesin. Ton eşleme ve çıkış renk uzayını kur; ekran görüntüsünü değerlendirirken aynı ışık ve exposure değerlerini koru.

Etkileşim ve erişilebilirlik

16. Sürükleyerek kamerayı döndürme ve kontrollü yakınlaşma ekle. Kameranın tabanın altına geçmesini veya dioramayı tamamen kaybettirmesini engelle. Kontrollerin ne yaptığını kısa etiketlerle anlat.
17. “Görünümü sıfırla” düğmesi kamerayı ve hedefini güvenilir biçimde başlangıç konumuna döndürsün. “Duraklat / devam et” animasyon zamanını kontrol etsin; duraklatılmış sahnede kullanıcı kamerayı yine inceleyebilsin.
18. İşletim sisteminin azaltılmış hareket tercihini ilk açılışta ve uygulama açıkken tercih değiştiğinde dikkate al. Tercihin iki yöndeki değişimini dinle; sahneyi yeniden yüklemeye gerek kalmadan uygula. Bu modda gereksiz sürekli hareket ve otomatik kamera dönüşü olmasın. Kullanıcının açıkça istediği kamera hareketleri ve kontroller çalışmaya devam etsin. Sistem tercihi değişirken kullanıcının elle seçtiği duraklatma durumunu kaybetme; dinleyiciyi sahne kapanırken temizle.
19. Telefon boyutlu ekranlarda kontrolleri yeniden yerleştir. Dokunma hedefleri rahat kullanılsın; sahne, açıklama ve düğmeler birbirine binmesin. Klavye odağı, erişilebilir düğme isimleri ve anlaşılır yükleme/hata durumu ekle. WebGL desteklenmiyorsa boş ekran gösterme.

Çalışma döngüsü ve performans

20. Tek bir animasyon döngüsü kullan. Yeniden boyutlandırma, sekmeden ayrılıp dönme ve sahneyi kapatıp yeniden açma ikinci bir döngü veya biriken event listener üretmesin. Sayfa görünür olmadığında gereksiz çalışmayı azalt. Geri dönüldüğünde delta time sıçramasını sınırlayarak hareketin atlamasını önle.
21. Sahne kapanırken geometri, malzeme, texture, render target, kontrol ve dinleyici kaynaklarını uygun biçimde temizle. Aynı kaynak birden çok nesne tarafından paylaşılıyorsa sahipliğini açık tut. Gereksiz her-frame allocation yapma.
22. DPR, su mesh çözünürlüğü, gölge kalitesi ve pahalı efektler için ölçülebilir bir kalite bütçesi oluştur. Performans düşüşünde önce hangi ayarların azaltılacağını açıkla. Görüntüyü bozacak bir düşürmeyi sessizce yapma.
23. Masaüstünde 60 FPS, kısıtlı cihazlarda 30 FPS seviyesini başlangıç hedefi olarak kullan; bunu sonuç garantisi diye sunma. Gerçek ölçümde cihazı, tarayıcıyı, viewport boyutunu, DPR'ı, kalite ayarını ve ölçüm süresini yaz. Mobil viewport ölçümünü fiziksel telefon testi olarak adlandırma.

Görsel değerlendirme

24. Görsel karşılaştırma için sabit seed, sabit kamera/target, sabit ışık, sabit kalite ve dondurulmuş shader zamanı sağlayan küçük bir test modu oluştur. Test modu normal kullanımda görünmek zorunda değil. Önerilen karşılaştırma kareleri: masaüstü 1440×900, mobil 390×844 ve kesiti açıkça gösteren ikinci bir kamera açısı. Bunlar bu yeniden üretim için önerilen test boyutlarıdır.
25. Her turda önce mevcut görüntüyü incele. En önemli üç görsel sorunu sırala. Yalnızca bunları düzelt; aynı sabit ayarlarla yeni ekran görüntüsü al ve önceki sürümle karşılaştır. Bir sorunu daha fazla dekorasyon ekleyerek gizleme.
26. Öncelik sırası: kadraj ve siluet, su/kara oranı, su altı okunurluğu, kesit birleşimi, kaya malzemesi, küçük ayrıntılar, UI. İlk başarılı derlemede durma; görüntüyü de incele.
27. Pixel-perfect aynı görüntüyü farklı GPU'larda garanti etme. Sabit test koşullarıyla karşılaştırmayı tutarlı kıl; küçük render farklılıklarıyla gerçek kompozisyon veya geometri hatalarını ayır.

Teslim

Önce kısa uygulama planını ve başlangıç varsayımlarını yaz. Sahneyi aşamalı geliştir. Çalışan proje, gerçekten çalıştırılmış kurulum/build/test komutları, kullanılan bağımlılık sürümleri ve kilit dosyasıyla teslim et. Çalıştırılamayan kontrol varsa ayrı belirt.

Son raporda ekran görüntüleri, görsel kabul kontrolü, performans ölçüm koşulları, bilinen sınırlamalar ve hangi efektlerin yaklaşık hesaplandığı bulunsun. README'ye başkasının projeyi temiz bir ortamda başlatabileceği doğrulanmış adımları ekle. Hesap, gizli anahtar veya özel dosya yolu gerektiren bir tarif bırakma.

Bu sürümün kapsamı kıyı, kayalar, kum, bitkiler, su ve kontroller. Deniz canlıları, insanlar ve piknik eşyaları ekleme.
```

## Aşamalı takip promptları

Hepsini arka arkaya vermek yerine, mevcut soruna uygun olanı kullan. İyi çalışan bölümlerin korunmasını özellikle iste.

### 1 Kadraj ve büyük kütleler

```text
Bu ekran görüntüsünü ana brief ile karşılaştır. Şimdilik shader ayrıntısı ve küçük dekor ekleme. Kamera yüksekliği, ön kesitin görünürlüğü, su/kara oranı ve kaya silueti içindeki en önemli üç sorunu seç. Her biri için somut bir geometri veya kamera düzeltmesi öner ve uygula. Başlangıç kadrajında dioramanın tüm sınırları görünsün. Önce/sonra karelerini aynı viewport ve sabit ayarlarla al. Hangi sorunun düzeldiğini kısa cümlelerle açıkla.
```

### 2 Su altı ve kesit

```text
Kadrajı, kaya yerleşimini ve ışığı koru. Yalnızca suyun okunurluğunu ve kesit birleşimini geliştir. Kum ve su altındaki kaya siluetleri seçilsin; derin bölüm mavi kalsın. Opaklığı rastgele azaltmak yerine derinlik, yansıma, normal şiddeti ve çizim sırasını ayrı ayrı kontrol et. Üst yüzey ile ön kesit arasındaki boşlukları ve farklı açılardaki saydamlık hatalarını düzelt. Üç sabit açıdan sonuç göster. Kullandığın görsel yaklaşımın sınırlarını belirt.
```

### 3 Kaya ve kıyı karakteri

```text
Su ayarlarını ve kamerayı koru. Kayalardaki tekrar hissini azalt. Büyük, orta ve küçük kütleler arasında belirgin ölçek farkı; yönlü çatlaklar; sıcak ve soğuk yüzeylerin ölçülü renk farkı oluştur. Kaya yüzeyini aşırı pürüzlü yapma. Kum-kaya-su birleşimlerini kontrol et. Seyrek bitki kümeleriyle ölçek hissini güçlendir. Aynı seed ile aynı sahnenin yeniden üretildiğini doğrula.
```

### 4 Görsel karşılaştırma turu

```text
Son ekran görüntüsüyle bir önceki sürümü yan yana değerlendir. Kadraj, siluet, su altı okunurluğu, kesit birleşimi, renk dengesi ve UI örtüşmeleri başlıklarında kısa bir rapor çıkar. Geriye giden bir alan varsa söyle. En yüksek etkili üç düzeltmeyi uygula. İyileşmeyen değişikliği gerekçesiz tutma. Karşılaştırmada kamera, seed, ışık, shader zamanı, viewport, DPR ve kalite seviyesini sabit tut.
```

### 5 Mobil ve erişilebilirlik

```text
Sahneyi dar, uzun ve yatay viewportlarda denetle. Kaydırma, dokunarak döndürme ve UI etkileşimi çakışmasın. Sıfırla, duraklat/devam et ve azaltılmış hareket davranışını ayrı ayrı test et. Klavye odağı görünür olsun. Ekran taşmalarını düzelt. Azaltılmış hareket açıkken kamera kullanımı mümkün kalsın. Uygulama açıkken sistemin hareket tercihini açıp kapat; her iki değişikliğin sayfayı yenilemeden uygulandığını ve kullanıcının elle seçtiği duraklatma durumunun korunmasını doğrula. Tercih değişikliğinin dinleyicisi kapanışta temizlensin. Testi masaüstü tarayıcısında mobil viewport ile yaptıysan raporda tam olarak bunu yaz; fiziksel telefon testi iddiası ekleme.
```

### 6 Performans ve kaynak temizliği

```text
Görsel görünümü değiştirmeden önce darboğazı ölç. Isınma süresinden sonra sabit süreli bir örneklem al; FPS yanında frame-time dağılımını, draw call ve üçgen sayısını raporla. DPR ve kalite koşullarını yaz. Profil sonucuna göre en pahalı işi azalt. Sahneyi tekrar açıp kapat; sekme görünürlüğünü, resize ve pause/resume geçişlerini denetle. Animasyon döngüleri, dinleyiciler veya GPU kaynakları birikiyor mu kontrol et. Ölçebildiğin ve ölçemediğin noktaları ayır. Optimizasyon sonrasında aynı görsel karelerle regresyon kontrolü yap.
```

### 7 Temiz kurulum ve teslim

```text
Projeyi başka birinin çalıştıracağı şekilde denetle. Paket yöneticisini ve sürümleri gerçek dosyalardan çıkar. Kilit dosyasına uygun temiz kurulum, geliştirme, build ve varsa test komutlarını çalıştır. README'deki adımların bunlarla aynı olduğunu kontrol et. Olmayan test scripti uydurma. Erişilemeyen özel dosya, mutlak yerel yol, eksik asset ve lisansı belirsiz varlıkları bul. Başarılı kontrolleri, başarısız kontrolleri ve hiç denenmeyenleri ayrı yaz. Yayınlama yapma.
```

## Görsel kabul kontrolü

Bir sürümü paylaşmadan önce şu maddeleri ekran görüntüsü ve çalışan uygulama üzerinden kontrol et:

- İlk bakışta kıyı dioraması ve suyun hacmi anlaşılıyor
- Ön kesit ile üst su yüzeyi aynı sahneye ait görünüyor; aralarında çatlak yok
- Kum ve su altındaki büyük biçimler seçiliyor
- Kayalar farklı büyüklüklerde ve birbirinin kopyası gibi görünmüyor
- Farklı kamera açılarında belirgin saydamlık sıralama hatası oluşmuyor
- Sıfırlama, duraklatma ve devam etme birden çok kullanımda doğru çalışıyor
- Küçük ekranlarda önemli sahne parçaları ve kontroller örtüşmüyor
- Azaltılmış hareket tercihi ilk açılışta ve uygulama açıkken iki yönde değiştirildiğinde uygulanıyor; elle duraklatma durumu korunuyor
- Shader ve uygulama konsolunda açıklanmamış hata yok
- Tekrarlı açma/kapama ve resize kontrollerinde kaynak birikimi araştırılmış
- Performans sayıları test ortamıyla birlikte yazılmış
- Çalıştırma adımları gerçekten denenmiş

## Yaşayan Koy için iki aşamalı genişletme

Bu bölüm Ocean Shader Lab'in mevcut halinden sonraki yönü tarif ediyor. İlk sürümün kapsamı özgün Ege kıyısı geometrisi, küçük ve gerçekçi bir balık sürüsü, deniz çayırı ve bunların suyla tutarlı görünmesi. Piknik yapan aile ayrı bir ikinci aşama; sahnenin görsel kalitesine uyduğu doğrulanmadan eklenmemeli.

### Aşama 1 Özgün Ege kıyısı ve su altı yaşamı

```text
Ocean Shader Lab'in çalışan su ve etkileşim altyapısını kullanarak “Yaşayan Koy” adlı yeni bir sahne geliştir. İlk sürümün kapsamı özgün bir Ege kıyısı, küçük ve gerçekçi bir balık sürüsü ve deniz çayırı. İnsan, piknik eşyası veya başka canlı türleri ekleme.

Mevcut kıyının yerleşimini aynen korumak yerine yeni ve özgün bir kıyı geometrisi tasarla. Ege'de küçük, doğal bir koy hissi versin: asimetrik kıyı çizgisi, suya doğru alçalan kumlu taban, aşınmış ve çatlaklı kaya kütleleri, yer yer su altında devam eden kaya çıkıntıları. Belirli bir fotoğrafı, mevcut sahne siluetini veya tanınan bir kıyıyı birebir kopyalama. İlk kadrajda hem su yüzeyi hem öndeki kesit hem de su altındaki yaşam görülsün.

Görsel dil gerçekçi olsun. Low-poly, faceted veya oyuncak gibi görünen varlıklar kullanma. Kayalardaki doğal kırılma yüzeyleri ile düşük çokgen sayısından kaynaklanan yapay köşeli görünümü ayır. Malzeme ayrıntısının ölçeği, suyun rengi, ışık yönü ve gölgeler aynı gerçekçi dünyaya ait görünsün.

Önce yeni kıyının büyük kütlelerini ve taban eğimini çöz. Bu yerleşim okunaklı hale geldikten sonra az sayıda küçük balıktan oluşan tek bir sürü ekle. Balıkların oranları, gövde formu, yüzgeçleri ve hareketi uzaktan da doğal görünsün. Sürünün yön ve hız değişimleri yumuşak olsun. Balıklar kayaların, tabanın veya birbirlerinin içinden belirgin biçimde geçmesin; su yüzeyinin üstüne çıkmasın. Hareket alanını sahnenin gerçek su hacmiyle sınırla.

Deniz çayırını uygun sığ taban bölgelerine seyrek, düzensiz kümeler halinde yerleştir. Kökler zemine otursun. Şerit uzunluğu, yönü ve kümelerin yoğunluğu kontrollü çeşitlensin. Suyun altında hafif ve uyumlu biçimde salınsın; kara çimi gibi dik ve tekdüze görünmesin. Balıkların ve deniz çayırının ölçeği birbiriyle tutarlı olsun.

Su altındaki canlıları görünür kılmak için su malzemesini gereksiz yere renksizleştirme. Derinlik rengi, yansıma, kırılma yaklaşımı ve saydamlık sıralamasını birlikte denetle. Yeni kıyı geometrisi su derinliği hesabına ve kesit birleşimine doğru yansısın. Kayalık zeminin değişmesi eski derinlik maskelerinde veya köpük sınırlarında hataya yol açmasın.

Önce yeni kıyıyı, sonra balık sürüsü ve deniz çayırını aşamalı ekle. Her aşamada aynı seed, kamera, ışık, dondurulmuş shader zamanı, viewport, DPR ve kaliteyle ekran görüntüsü al. Yeni kıyının kadrajını seçtikten sonra sonraki görsel karşılaştırmalarda sabit tut. Önceki sahnenin ölçümleriyle ve yeni sahnenin canlılar eklenmeden önceki haliyle performans farkını ayrı raporla.

Frame time, draw call ve geometri maliyetini ölç. Görsel kaliteyi koruyarak tekrarlı geometri paylaşımı, instancing veya uygun animasyon tekniklerini değerlendir. Basitleştirme gerekiyorsa önce nesne sayısını ve görünmeyen ayrıntıları azalt; görünür biçimleri low-poly hale getirerek hedef görüntüyü bozma.

Duraklatma tüm sürekli hareketleri durdursun; kamera incelenebilir kalsın. Azaltılmış hareket tercihini hem ilk açılışta hem uygulama açıkken açılıp kapatıldığında uygula. Sistem tercihinin değişmesi kullanıcının elle duraklatma seçimini geçersiz kılmasın. Balıkların, çayırın ve suyun hareketi için tek ve tutarlı bir zaman yönetimi kullan.

Masaüstü ve mobil viewport, farklı kamera açıları, su altı görünürlüğü, reset, pause/resume, dinamik azaltılmış hareket, resize ve tekrarlı sahne açma/kapama kontrollerini tamamla. Dinleyicilerin, animasyon döngülerinin ve GPU kaynaklarının birikmediğini araştır. Fiziksel telefonda denenmediyse mobil viewport testini bu şekilde adlandır.

Teslimde tamamlanan özellikleri, karşılaştırmalı ekran görüntülerini, ölçüm koşullarını ve kalan görsel sorunları yaz. Aile ve piknik bu ilk sürüme dahil değil. Yayınlama veya deploy yapma.
```

### Aşama 2 Görsel kaliteye uyan piknik sahnesi

Bu prompt, ilk sürümün kıyı, su ve canlılar için görsel kabul kontrolleri tamamlandıktan sonra ayrı bir çalışma olarak kullanılmalı.

```text
Yaşayan Koy'un tamamlanmış ilk sürümünü incele. Özgün Ege kıyısını, suyu, küçük balık sürüsünü ve deniz çayırını koru. Şimdi kıyının uygun bir bölümüne piknik yapan küçük bir aile eklemek için ayrı bir kalite denemesi yap.

Aile grubu, örtü ve az sayıda piknik eşyası ana sahneyle aynı gerçekçi görsel kaliteyi taşımalı. Low-poly, faceted, oyuncak veya çizgi film karakteri görünümü kullanma. İnsan oranları, oturma pozları, kıyafet kıvrımları, zemine temas ve gölgeler doğal görünsün. Gerçek kişilere benzetme. Sahnenin ölçeğinde fark edilmeyen yüz ayrıntılarına gereksiz bütçe harcama; anatomik ve görsel kusurları küçük ölçekle gizlemeye çalışma.

Yerleşim suyu, ön kesiti veya su altı yaşamını kapatmasın. Karakterlerin ve eşyaların ölçeği kayalarla tutarlı olsun. Kıyıda fiziksel olarak oturulabilecek bir nokta seç; insanları veya eşyaları havada, kaya içinde ya da suyla kesişmiş bırakma.

Önce bu küçük grubun sabit bir görsel denemesini yap. Başlangıç kadrajında ve daha yakın bir açıdan kıyı malzemeleri, ışık, gölge, gerçekçilik ve detay kalitesiyle uyumunu denetle. Grup sahnenin kalite seviyesine ulaşmıyorsa ana sahneye dahil etme; eksikleri ve uygulanabilir seçenekleri açıkla. Ücretli asset veya servis gerekiyorsa satın almadan önce maliyet ve lisans koşullarını bildir.

Kalite uyumu sağlanırsa grubu entegre et. Küçük hareketler eklenecekse sakin ve sınırlı olsun. Azaltılmış hareket ve elle duraklatma tüm ilgili animasyonlarda çalışsın; sistem tercihi uygulama açıkken değiştiğinde de davranışı doğrula.

Aile eklenmeden önce ve sonra aynı sabit test koşullarıyla ekran görüntüsü ve performans ölçümü al. Görsel kaliteyi, sahnenin odak noktasını ve çalışma döngüsünü koruduğunu doğrula. Sonuç raporunda kalite denemesiyle ana sahneye gerçekten entegre edilen özellikleri ayır. Yayınlama veya deploy yapma.
```

## Yeniden kullanılabilir proje sayfası şablonu

Aşağıdaki alanları her yeni çalışma için doldur. Doğrulanmamış link veya test sonucunu sayfaya ekleme. Link henüz yoksa ilgili satırı çıkar.

```text
PROJE ADI
[Projenin adı]

KISA AÇIKLAMA
[Ne ürettim, kullanıcı neyi deneyebilir? İki cümle.]

DENE
[Doğrulanmış canlı demo bağlantısı]
[Doğrulanmış kaynak kod bağlantısı]

NE VAR
[Gerçekten çalışan 3–5 özellik]

NASIL GELİŞTİRDİM
[İlk brief, önemli görsel/teknik düzeltmeler ve kullanılan teknoloji]
[Önce/sonra görüntüleri; aynı kadrajda karşılaştırma]

BUNU KENDİN YAP
[Bu projeye uyarlanmış ana prompt]
[İlk sonuçtan sonra en çok işe yarayan takip promptları]
[Doğrulanmış kurulum ve çalıştırma adımları]
[Varsa asset kaynakları ve lisansları]

KONTROL ETTİKLERİM
[Test edilen etkileşimler]
[Test edilen ekran boyutları]
[Gerçek cihaz/tarayıcı, DPR, kalite ayarı ve ölçüm yöntemiyle performans]

SINIRLAR
[Yaklaşık hesaplanan efektler, denenmemiş cihazlar, bilinen kusurlar]

SONRAKİ DENEME
[Henüz yapılmamış geliştirme fikri; açıkça gelecek sürüm olarak işaretle]
```

Ocean Shader Lab için kullanılabilecek kısa açıklama:

> Three.js, TypeScript ve GLSL ile geliştirdiğim etkileşimli bir kıyı dioraması. Şeffaf suyu, su altındaki zemini ve kıyının kesitini farklı açılardan inceleyebiliyorsun.

Süreç bölümüne uygun kısa metin:

> Geliştirme boyunca aynı kadrajdan ekran görüntüleri alıp suyun görünürlüğünü, kaya siluetlerini ve kıyı kesitini karşılaştırdım. Her turda en belirgin sorunları düzelterek ilerledim. Yeniden denemek isteyenler için ana promptu, düzeltme promptlarını ve kontrol listesini de ekledim.

## Gerçek depoyla eşleştirme notu

Bu taslak mevcut `PROMPT.md` dosyasının yerine henüz geçirilmedi. Mevcut repo Vite 8.3.2, TypeScript 7.0.2 ve Three.js 0.186.1 kullanıyor. `npm run dev` yerel 4173 portunu açıyor; `npm run check`, `npm test`, `npm run test:e2e`, `npm run build` gerçek scriptler. 2026-10-04 kontrolünde TypeScript, 17 unit, 17 browser ve build geçti. Bu turda `npm ci` yeniden çalıştırılmadı; temiz kurulumun yeniden denendiği iddia edilmez. Kilit dosyası mevcut. Mevcut repo tek döngü ve statik kıyı renk/derinlik önbelleği kullanır; yeni hareketli sualtı yaşamı ayrı dinamik render katmanı gerektirir.

Eski mevcut `PROMPT.md` hâlâ önceki açık kıyı kadrajı, farklı kamera ve kesitsiz dünya tarifini içeriyor. Yayın için kabul edilmiş güncel sahnenin tam teknik tarifi ayrıca eşleştirilmeli. Portföy bileşeni, prompt ve poster'i aynı doğrulanmış commit/release'ten almadan üretim build'ine izin vermiyor.

## Teknik referanslar

Uygulama ajanı, kullandığı Three.js sürümüne uygun API'leri ayrıca doğrulamalı.

- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html): renderer yaşam döngüsü, çizim istatistikleri, DPR ve saydam nesne sıralaması
- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html): kamera hedefi, hareket sınırları, dokunma ve sıfırlama davranışı
