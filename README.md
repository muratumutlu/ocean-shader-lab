# Ocean Shader Lab

![Ocean Shader Lab: mavi su, kum ve kayalarla etkileşimli kıyı dioraması](./public/poster.webp)

Tarayıcıda çalışan etkileşimli bir kıyı dioraması: şeffaf mavi su, görünen deniz tabanı, hareketli kıyı köpüğü, sıcak tonlu parçalı kayalar, kum ve bitki örtüsü. Önden ve yanlardan suyun hacmini gösteren kesit yüzleri var. Three.js, TypeScript ve GLSL ile özgün olarak uygulandı; görsel araştırmanın ilk esin kaynağı Marco Ludovico Perego'nun kıyı dioramasıydı. Referans görsel veya onun kaynak kodu dağıtılmıyor.

## Geliştirme önizlemesi — Yaşayan Koy

Aşağıdaki 6 saniyelik GIF, gerçek Three.js sahnesinin geliştirme sürümünden alınmış bir kamera turudur (700×438, yaklaşık 2,8 MB). Yeni koy ve jeolojik kesit çalışmasını gösterir; mevcut canlı sürümden farklıdır. Kaplumbağa ve sonraki oyun özellikleri bu önizlemede yer almıyor.

![Yaşayan Koy geliştirme önizlemesi: kamera kayalık kıyı, hareketli dalgalar ve jeolojik kesit etrafında dolaşıyor](./docs/media/living-cove-preview.gif)

## Çalıştır

Bu sürüm Node 26.7.0 ve npm 11.19.0 ile kontrol edildi. Desteklenen çift numaralı Node >=22.12 kullanın. `package-lock.json` dosyasını koruyun.

```sh
npm ci
npm run dev
```

Yerel adres http://127.0.0.1:4173. Kontroller:

```sh
npm run check
npm test
npm run test:e2e
npm run build
```

Tarayıcı testleri ayrı Chromium kullanır. Gerekiyorsa bir kez `npx playwright install chromium` çalıştırın. 2026-10-04'te önceki kontrol 74'te korunan sahne için TypeScript, 17 birim testi, 17 tarayıcı testi ve build geçti. İçerik güncellemesi 75'te TypeScript ve build geçti; 17 birim testinden 8'i geçti, geometri kuran 9 test 5 s timeout verdi. Tek worker ile, aynı deadline korunarak yapılan bir tekrar aynı 9 timeout ile sonuçlandı. İlgili iki fallback browser testinden prompt navigation geçti; WebGL-absence testi dev-server gezinmesinde 15 s timeout aldı. Bu sırada 16 çekirdekli host'ta load average 141.5 ve sonra 202.3 gözlendi. Kaynak hash'leri değişmedi; bu sonuçlar geçmiş tam test başarısının yerine başarılı bir yeni tam tur diye sunulmaz. Yeni üretim asset'leri ayrıca doğrudan HTTP/fallback yüklemesiyle kontrol edilir. Bu son içerik güncellemesinde `npm ci` yeniden çalıştırılmadı; temiz kurulumun bu turda tekrar denendiği iddia edilmez.

Kurulu stack: Three.js 0.186.1, @types/three 0.186.0, Vite 8.3.2, TypeScript 7.0.2, Vitest 5.0.3, Playwright 1.63.0. Uygulamada React, backend, veritabanı veya ücretli üretim API'si yok.

## Sahneyi incele

Sürükleyerek orbit, scroll ile kontrollü zoom; Play/Pause ile dalga hareketi. Coast settings içinde swell 0..1, water level -.35..+.35, sun direction 0..360°, Auto/Low/Balanced/High kalite ve kamera reset var. Fullscreen reddedilirse kullanıcının açabileceği ayrı bir bağlantı gösterilir.

Azaltılmış hareket ilk açılışta durağan sahne verir. Tercih uygulama açıkken etkinleştirilirse hareket durur; kullanıcı Play ile açıkça devam edebilir. Tercihin kapanması elle pause edilen sahneyi kendiliğinden oynatmaz. Gizli sekmede zaman ve animasyon döngüsü durur. WebGL2 gereklidir; destek yokluğu, shader hatası veya context loss durumunda bu sürümün kendi sahnesinden üretilen poster, prompt bağlantısı ve Retry kullanılabilir.

## Bunu kendin yap

[PROMPT.md](./PROMPT.md) güncel kıyı kesitini kurmak için ayrıntılı ana prompt, teknik sahne bilgileri, aşamalı düzeltme promptları, görsel kabul kontrolü ve gelecek sürüm fikirlerini içerir. Aynı UTF-8 dosya byte-for-byte build'e kopyalanır; yayın kontrolü eşleşmesini ve SHA-256 değerini doğrular. Tarif benzer bir sonuç üretmeye yardımcı olur; tek seferde aynı görüntü veya farklı GPU'larda pixel-perfect eşleşme garantisi vermez.

Mevcut sahne seed 7 ile tekrar üretilir. Ortak 129×129 yükseklik/rock-mask verisi, 32×24 arazi/su alanı, CPU/shader bilinear yükseklik örneklemesi, dalgalarla ortak kesit üst kenarı ve gerçek zemine oturan kesit alt kenarı kullanılır. Perspektif kamera FOV 34.73°, hedef [0,2.22,1.48]; varsayılan desktop konumu [20.85,12,32.64]. Portre kadrajı aynı hedef etrafında ölçeklenir. Kesit su shaderı görsel soğurma/saçılma yaklaşımı kullanır. Kaya yüzeyleri prosedürel; eski küresel kaya dizilimi ve kesitsiz açık kıyı kadrajı bu sürümün tarifi değildir.

## Render ve performans

Statik kıyı lineer renk/derinlik hedeflerine kaydedilir. Kamera, ışık, tide, kalite veya buffer boyutu değişince önbellek yenilenir; ordinary dalga animasyonunda tüm arazi ve kayalar her kare yeniden çizilmez. Su yüzeyi, kesit ve optik kaynaklar aynı su fabrikasının sahipliğindedir. Tek zaman döngüsü ve idempotent dispose kullanılır. Auto, üç saniyelik sürekli yavaşlıkta kaliteyi düşürür; manuel kaliteyi değiştirmez. DPR cap Low/Balanced/High için 1/1.5/2. Hedefler 60 desktop/30 küçük ekran FPS'dir; sonuç garantisi değildir.

Ölçümler arasında fark var; aşağıdaki sonuçlar birleştirilmedi:

| Ölçüm | Ortam ve koşullar | Masaüstü | Mobil boyutlu viewport |
|---|---|---:|---:|
| Geçmiş kontrol 63 | Apple M3 Max, ANGLE Metal, headed Chromium 153.0.8010.12; 3.4 s ısınma + 10 s pencere, Auto/Balanced | 1440×900, DPR 1: 60.0 rendered FPS; p95 17.9 ms | 390×844, DPR 2: 30.0 rendered FPS; p95 40.1 ms |
| Güncel korunan sahne, kontrol 74 | Aynı raporlanan Mac/GPU/tarayıcı; 3.4 s ısınma + 10 s pencere, Auto ölçüm sırasında Low'a indi | 1440×900, DPR 1: 30.0 rendered FPS; p95 34.8 ms | 390×844, DPR 2: 22.6 rendered FPS; p95 66.9 ms |

FPS, default framebuffer'a gerçekten gönderilen renderlardan ölçüldü; callback sayısı FPS diye sunulmadı. Ölçüm pencerelerinde video kaydı veya canvas readback yoktu. Güncel mobil viewport son drawing buffer'ı Low'da 390×844 idi. Ek beş saniyelik headed masaüstü tanılamasında görünür ve odaklı sayfanın ham requestAnimationFrame temposu da yaklaşık 30/s bulundu. Önceki 60 FPS koşuluyla eşdeğer bir ortam olduğu doğrulanmadı; farkın nedeni kesinleştirilmedi ve yalnız shader maliyetine bağlanmadı. CPU submission zamanı GPU execution zamanı değildir.

Mobil viewport, gerçek Mac üzerinde küçük ekran/touch iş yüküdür; fiziksel telefon testi değildir. Önceki SwiftShader sonuçları ayrı yazılım-GPU ölçümleridir; bugünkü Metal sayılarıyla bir performans vaadinde birleştirilmez. Yeni özelliklerin performansı mevcut koşulda önce/sonra ölçülmelidir.

## Embed ve yayın sınırı

`wrangler.jsonc` yalnız `dist` statik asset'lerini yüklemek için yapılandırılmıştır. Worker kodu, server, veritabanı veya secret yok. HTTP `_headers` framing'i https://portfolio.muum.ai ile sınırlar. Yerel geliştirme parent'ı 4321 portundadır; bu origin üretim JavaScript'inden çıkarılır. Mesajlar origin, source window, channel, version ve payload'a göre doğrulanır. Sahne kapanınca renderer kaynakları temizlenir.

Build allowlist'i yalnız index.html, kendi poster.webp'si, tam PROMPT.md, _headers ve üretilmiş JS/CSS asset'lerini kabul eder. Env/credentials, özel kanıtlar ve tasarımlar, orijinal referans, source map ve eski portföy projeleri yayınlanmaz. Yerel build'in geçmesi dışarıda deployment yapıldığı anlamına gelmez. Bu README’de kayda geçirilen önceki sahne güncellemesinde commit, push veya deploy yapılmadı. README medyası ayrı bir dokümantasyon güncellemesidir.

## Sınırlar ve sonraki sürüm

Dalga, köpük, caustic, refraction ve kesit soğurması görsel yaklaşımlardır. Hydrodynamic solver, fiziksel fluid collision veya ray-traced renderer yok. Görüntü prosedürel CGI niteliğindedir; fotoğraf gerçekçiliği iddiası yok. Ekran uzayındaki refraction ve sonlu kesit hacminin görüş açısına bağlı sınırları vardır. Test sayısı görsel kalitenin kanıtı sayılmaz.

Yaşayan Koy ayrı bir geliştirme çalışmasında ilerliyor: özgün Ege kıyısı ve küçük çakıl plajı, bir balık sürüsü, deniz çayırı, canlı yoğunluğu, gün saati ve deniz durumu. Bunlar mevcut Ocean sürümünde çalışan özellikler değildir. Piknik yapan aile ikinci aşama olarak ayrıldı.
