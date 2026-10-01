# Pomysły — Krasnokopalnia

Luźny notatnik na wszystko, co przyjdzie do głowy. Nieuporządkowane, bez presji — jak coś dojrzeje, przenosimy to do GDD.

---

## Pomysły

- Gra to połączenie klikera, arkanoida i incremental buildera.
- Wielka mapa złożona z bloków = podziemna kopalnia.
- Na górze mapy: obóz krasnoludów — tam rozwijasz klan i wysyłasz krasnoludy do kopalni, żeby kopali.
- Część arkanoidowa: krasnoludy jako kulki (z grafiką krasnoluda) latają po wolnej przestrzeni kopalni i rozbijają bloki.
- Widok gry: z boku, typowo jak w Terrarii.
- Ściany/bloki, które krasnoludy rozbijają, to różne surowce.
- Surowce ze skopania służą do rozwoju obozu: ulepszanie obozu, rekrutacja nowych krasnoludów, kupowanie upgradów itp.
- Krasnoludy-kulki żyją tylko określony czas — dokładnie tyle, ile mają piwa przy sobie.
- System racji żywieniowych: piwo przypisuje się do konkretnej kulki/krasnoluda przed wysłaniem.
- Piwo trzeba produkować (osobny łańcuch produkcji w obozie).
- Cel gry: okopać całą możliwą mapę.

### Szyb, platformy, tory, stacje

- Obóz ma na środku szyb kopalniany — to pionowy transport w dół. Na start szyb ma ok. 50 metrów głębokości.
- Żeby powiększyć szyb: zrzucasz bombę, która rozbija bloki w obszarze przy impakcie na dole szybu — robi się dziura.
- Na świeżo zrobionej dziurze montujesz platformę.
- Platforma to nowy punkt startowy do wystrzeliwania krasnoludów (tu nadaje się im kąt/siłę wystrzału).
- Do platformy można zbudować szyb windy łączący ją z obozem.
- Żeby zejść niżej: kolejna bomba, kolejna platforma, i tak w dół.
- Kopanie w głąb samymi krasnoludami (bez nowej platformy) jest teoretycznie możliwe, ale nieefektywne — nowy krasnolud wystrzelony z góry może nie trafić w już wykopany kanał w dole, więc łatwo go zmarnować. Stąd sens platform.
- Tory: z platformy, jeśli są już wykopane jakieś tunele, można prowadzić tory w bok (transport poziomy, uzupełnienie pionowego szybu).
- Stacje: punkty na torach, na które transportowany jest krasnolud i z których dopiero jest wystrzeliwany — to daje większą kontrolę nad tym, gdzie się kopie.
- Budowa torów i stacji kosztuje surowce (to inwestycja, nie coś darmowego).
- Sposób zbierania surowców przez stacje — nieustalone, do przemyślenia później (rozważane kierunki: strata surowców poza zasięgiem, "porzucona ruda" czekająca na odbiór, stacja jako booster ilości, albo osobny typ krasnoluda-zbieracza jeżdżącego i zbierającego rudę — ten ostatni kierunek najbardziej na razie na czasie, bo i tak planowane są różne typy krasnoludów o różnych rolach).

### Rodzaje krasnoludów

- **Intern** — umie rozbijać tylko podstawowy blok (najłatwiejszy). Łatwy w utrzymaniu, szybki.
- **Miner** — umie rozbijać wszystkie bloki (z odpowiednimi ulepszeniami). Wolny, dużo pije.
- **Tragarz** — lata jak kulka, ma jakiś promień działania (radius); nie działa jako stały bufor obecności — zamiast tego nakłada buff (zwiększony zysk z kopania) na kulki, które przelecą przez jego zasięg.
- **Demolka** — ma 2 rodzaje wybuchu: przy pierwszym styku, albo czasowo (po odliczeniu) — wybucha i rozwala więcej bloków naraz niż zwykłe uderzenie.
- **Wiertacz** — leci po prostej linii (nie odbija się chaotycznie jak reszta).
- **Skaut** — lata szybko; jeśli wleci w promień jakiegoś niewykopanego złoża metalu w niewidocznej (jeszcze nieodkrytej) części kopalni, oznacza to i odkrywa to miejsce na mapie.

### Zbieranie surowców — rozwiązanie problemu odległości od stacji

- Im dalej od najbliższej stacji rozbity zostanie blok, tym dłużej zajmuje, zanim surowiec do niej dotrze i będzie mógł zostać przetransportowany w górę (wagonikiem).
- Surowiec więc nie ginie i nie jest "porzucony" — ma po prostu czas dotarcia proporcjonalny do odległości od najbliższej stacji.
- Gęstsza siatka torów/stacji = szybszy obrót surowców = szybszy rozwój obozu.
- Otwarte pytanie: czy ten "surowiec w drodze" może być przechwycony/przyspieszony przez coś (np. tragarza przelatującego w pobliżu), czy to czysto pasywny timer działający w tle niezależnie od gracza — do ustalenia.

### Bossowie i walka w kopalni

- Kopalnia nie musi być pusta — w większych kraterach na mapie mogą siedzieć bossowie.
- Można dodać walkę wykorzystując tę samą mechanikę co zwykłe kopanie: wysyłasz kulki bojowe, odbijają się od ścian normalnie, a jak przelecą przez moba/bossa, to go biją.
- Boss może np. spawnować własne kulki typu fireball, które biją krasnoludy.
- Zabicie bossa daje jakiś zysk/nagrodę (nieustalone jeszcze co dokładnie).
- Krater = naturalna arena — geometria kraterów tworzy "pokoje bossów", więc projektowanie kraterów to jednocześnie level design starcia (miejsce na odbicia, unikanie fireballi).
- Otwarte pytania (nieustalone):
  - Czy kulki bojowe to osobny typ krasnoluda, czy każdy typ może walczyć, tylko wyspecjalizowany bojownik robi to efektywniej?
  - Czy fireball od razu zabija krasnoluda, czy odejmuje piwo/czas życia (walka jako dodatkowy drenaż tego samego zasobu)?
  - Czy nagroda z bossa to unikalny surowiec niedostępny ze zwykłych bloków?
  - Czy boss jest pasywny, dopóki go nie zaczepisz, czy po czasie może zacząć sam niszczyć/zagrażać mapie?
  - Skaut (patrz: rodzaje krasnoludów) mógłby też wykrywać bossów zanim się do nich zaatakuje na ślepo.

### Wymagania techniczne — mapa, chunkowanie, wydajność

Mapa ma być bardzo duża — mowa o milionach bloków. Wymaga to systemu chunkowania i streamowania, żeby to w ogóle dało się policzyć i wyrenderować.

**Chunkowanie**

- Mapa podzielona na chunki (np. 64×64 lub 128×128 bloków), ładowane/zwalniane zależnie od tego, gdzie aktualnie coś się dzieje (aktywne kulki + widoczny ekran).
- Blok trzymany jako lekka reprezentacja (typ + HP) — miliony bloków to wtedy megabajty, nie gigabajty.

**Streaming z pliku**

- Chunki poza aktywną strefą (daleko od kulek w locie, poza ekranem) serializowane na dysk, wczytywane z powrotem gdy potrzebne.
- Ma sens przy założeniu, że mapa jest generowana raz i trwała.

**System ekspozycji bloków (kluczowa optymalizacja fizyki + renderu razem)**

- Blok jest **aktywny** (liczony w fizyce i renderowany) tylko jeśli sąsiaduje z pustą przestrzenią (czyli "od strony kulek" — może zostać trafiony).
- Blok w pełni otoczony innymi blokami (brak sąsiedztwa z pustką) jest **discardowany całkowicie** — nie istnieje ani dla fizyki (kulka go nigdy nie sprawdza w kolizjach), ani dla renderu.
- Struktura danych: per-chunk lista/set aktywnych bloków (nie cała tablica wszystkich bloków) — po tym chodzi fizyka i renderer.
- Przy rozbiciu bloku sprawdzani są jego bezpośredni sąsiedzi — ci, którzy wcześniej byli "zamurowani", a teraz mają świeżą pustkę obok, awansują do aktywnych.
- Efekt: głębokie, nietknięte wnętrze mapy w ogóle nie obciąża silnika, dopóki coś obok nie zostanie rozbite.
- Pomysł do dalszego zbadania (przez użytkownika, w jego silniku): użycie tekstury jako "mgły wojny", gdzie blok = piksel, żeby porównywać chunki z tą teksturą i sprawdzać, czy coś było "widoczne" czy nie — niewidoczne olewać. Nieustalone, wymaga eksperymentów.

### Sklep — punkt wymiany surowców

- Potrzebny sklep/punkt wymiany surowców na inne surowce.
- Powód: krasnoludy nie potrafią wydobyć/wyprodukować wszystkiego same (np. drewno), a niektóre rzeczy (jak budowa szybów) tego wymagają.
- Szczegóły (kurs wymiany, waluta, ograniczenia) — nieustalone jeszcze.

### System ulepszeń — dwa rodzaje

- Będą ulepszenia **globalne** (trwałe, dotyczą np. całego klanu/rozwoju obozu) oraz **per-encja** (przypisywane pojedynczej kulce/krasnoludowi przy spawnie, jak piwo — zużywalny zasób na dany strzał).
- Szczegóły — które konkretne ulepszenia trafią do której kategorii — nieustalone jeszcze.

### Skrzynie skarbów

- Pomysł: skrzynie skarbów rozmieszczone albo losowo na mapie, albo jako nagroda po pokonaniu bossa — a może jedno i drugie naraz?
- Jak kulka przez nią przeleci, skrzynia się otwiera: dźwiękowy "pik", a na minimapie zaczyna pulsować to miejsce, żeby gracz mógł tam polecieć i kliknąć.
- Alternatywnie: może samo otwarcie nie następuje od razu przy przelocie kulki, tylko najpierw pojawia się info "znaleziono skrzynię", a otwarcie to osobny krok/akcja.
- Nieustalone, do przemyślenia później.

### System dni tygodnia

- System dni tygodnia — wydarzenia będą mogły reagować na konkretne dni, np. kupcy przybywają na targowisko w dany dzień tygodnia.

### Wypłaty

- Tygodniówki — trzeba będzie płacić krasnoludom cyklicznie (co tydzień).

### Nowe budynki obozu

- **Mennica** — pozwala przerabiać złoto na monety.
- **Huta** — przerabianie surowców/materiałów na surowce gotowe.
- **Biuro prasowe** — miejsce, gdzie wykonuje się misje; spływają tam nowe kontrakty do wykonania, a gotowe dostawy wysyła się właśnie tam.
- **Krypta** — magazyn surowców, fizyczny budynek na mapie (plecak typu grid) zamiast listy surowców w rogu ekranu; patrz: [[Krypta — magazyn surowców]].

### System discovery (ukryte eventy w blokach)

- Pod wyglądem nieodstającym od zwykłego otoczenia (np. wygląda jak zwykła skała) mogą się ukrywać różne eventy discovery.
- Przykłady: rozbicie bloku wyglądającego jak skała spawnuje skrzynię ze skarbem; rozbicie bloku wyglądającego jak ul wypuszcza z niego koboldy.
- Każdy taki discovery ma swój przypisany event, dzięki czemu można powiadomić gracza o odkryciu.
- Powiązane pomysły: [[Skrzynie skarbów]], [[Koboldy]].

### Mapa

- Podział u16 (solidType): 12 bitów typu bloku + 4 bity wariacji.
- Mapa musi dzielić się na layery.
- Musi być czytana z pliku pod kątem kolizji.
- Potrzebne coś na wzór stref — zajmują jakiś obszar na ekranie/mapie i jak wleci w nie kulka, wysyłają trigger.
- Trzeba mieć biomy.
- Bloki mają mieć standardowe zachowania: dmg, destroy, place.
- Bloki typu **spawn** — spawnują aktora i despawnują go w zależności od tego, czy kamera na nich jest (czy chunk jest aktywny).
- Bloki typu **spawnOnHit** — spawnują coś przy trafieniu w nie. Ma być w 2 wersjach:
  - blok się niszczy po trafieniu,
  - blok zostaje i dalej spawnuje przy każdym kolejnym trafieniu.
- Skoro bloki mają stały rozmiar, indeksować teksturę (atlas) zamiast podawać każdemu blokowi osobno `crop`.

### Pomysły na przyszłość (poza obecnym zakresem)

- Proceduralnie generowana mapa (potencjalnie, jako rozwinięcie na przyszłość — obecnie mapa ma być jedna, ręcznie zaprojektowana).
- Budynki obozu budowane/kupowane stopniowo z czasem, a nie cała wioska dostępna od razu na starcie.

### Biomy i tło

- Kopalnia musi mieć biomy — to w sumie te same odmiany bloków (kamień itp.), ale w stylistyce danego biomu.
- Do tego zmieniające się tło "za" blokami, zależnie od biomu/głębokości.
- Szczegóły (jakie konkretnie biomy, granice między nimi, na jakiej głębokości się zmieniają) — nieustalone jeszcze.

### Surowce

- Kamień
- Kości
- Żelazo
- Złoto
- Diamenty
- Obsydian
- Bedrock — kamień nieniszczalny, otacza mapę i niektóre miejsca
- Drewno — tylko ze sklepu (nie wydobywane w kopalni)
- Włókna — tylko ze sklepu (nie wydobywane w kopalni)

### Początek gry (intro / pierwszy tutorial flow)

**Wersja rozbudowana (fabularna)**

1. Czarny ekran, rozjaśnia się na miejscu, gdzie będzie obóz — na razie nic tam nie ma.
2. Zza ekranu wchodzi trójka krasnoludów: kurier, sejsmolog i geodeta. Rozmawiają między sobą: "ooo, a może tu się nada, wygląda obiecująco".
3. Wchodzą na teren przyszłego obozu, robią rozpoznanie terenu ("łubudubu"), po czym stwierdzają: to dobre miejsce, nadaje się! Trzeba powiadomić firmę — "spisuj list!".
4. Pojawia się okno "listu do firmy" — to w praktyce ekran nowej gry: nazwa kopalni, seed do generowania świata, wybór wielkości mapy, spis potencjalnych zasobów w okolicy.
5. Po zatwierdzeniu kurier biegnie zanieść list do firmy. Ekran się zaciemnia, napis "tydzień później", ekran się rozjaśnia.
6. Na uboczu mapy rozłożony jest namiot i ognisko z trójką rozpoznania. Podchodzi do nich nowy krasnolud — mówi, że dostali list, przedstawia się jako młodszy specjalista od stawiania placówek i marketingu kopalnianego, wysłany, by założyć tu nową placówkę. Od teraz on tu rządzi (to gracz).
7. Prosi, żeby go wprowadzili na miejsce, rozgląda się, komentuje ("jakieś gówno, ale dobra, nie z takim szajsem pracował i dawał radę"), gwiżdże i woła ekipę budowlaną.
8. Zza ekranu wbija ekipa do stawiania bazy — przewoźna suwnica na łapach, "Wiertacz 3000" i tego typu sprzęt. Ekran się zaciemnia, mija tydzień, ekran się rozjaśnia.
9. Widać efekt: postawiony pierwszy szyb, barak do spania i karczma. Koniec intra, gracz dostaje kontrolę.
10. Zaczyna się tutorial — CEO (gracz-postać z kroku 6) mówi, że możemy zaczynać: "kliknij, debilu, na bombę!".
11. Gracz klika, bomba spada, robi się wielkie "bum".
12. Info: idź do karczmy, kopnij w dupę budowlańca, żeby postawił pierwszą platformę.
13. Gracz to robi, potem kopie w dupsko pierwszą kulkę, wypuszcza ją na platformie — kulka zaczyna kopać.
14. Dalej to już gra — tipy od CEO w trakcie ("hej, wykopałeś nowy surowiec!", "masz na tyle, żeby coś postawić" itp.).

Otwarte pytanie: czy CEO (postać z intra) zostaje na stałe jako głos tipów/narratora w trakcie gry, czy to jednorazowa persona tylko na wstęp — do ustalenia, choć z opisu wynika, że raczej zostaje.

**Wersja skrócona (poprzednia, do porównania)**

1. Ciemna mapa, rozjaśnia się.
2. Widać w oddali obóz, zoom na niego.
3. Na środku obozu jest przygotowana bomba.
4. Gracz dostaje informację, żeby ją spuścić.
5. Spuszcza bombę, robi się "boom".
6. Gracz buduje pierwszą platformę (na świeżo zrobionej dziurze).
7. Podłącza windę do platformy.
8. Werbuje pierwszą kulkę w karczmie.
9. Spuszcza ją do tunelu/szybu.
10. Strzela z platformy.

### Firma — kim jest PIWO i czym jest IPA

- Firma-matka to spółka skarbu państwa Królestwa Krasnoludów: **PIWO** — Państwowy Inspektorat Wydobycia i Obróbki.
  - "Inspektorat" w nazwie naturalnie tłumaczy mechanikę audytów (patrz: [[Elementy korporacyjne z twistem krasnoludzkim]]) — to ta sama instytucja, która potem przyjeżdża kontrolować jakość piwa, którym płacisz krasnoludom.
  - Wielki Sztygar (CEO) nie jest właścicielem, tylko nominatem/urzędnikiem królewskim — otwiera to możliwość na króla jako niewidzialną, wyższą instancję (dekrety królewskie jako losowe eventy, zmiana "planu pięcioletniego" itp.) — nieustalone jeszcze, do przemyślenia później.
- Twoja konkretna placówka (ta, którą prowadzi gracz) to formalnie spółka-córka PIWO: **IPA** — Innowacyjna Placówka Autonomiczna.
  - Nazwa nawiązuje wprost do intra — to właśnie to, co zakłada "młodszy specjalista od stawiania placówek", patrz: [[Początek gry (intro / pierwszy tutorial flow)]].
  - Żart z nazw: PIWO i IPA to dwa gatunki piwa — spółka-matka i spółka-córka noszą imiona piwne, spójnie z całą resztą motywu piwa w grze.
  - "Innowacyjna" = IPA to program pilotażowy: PIWO testuje, czy autonomiczne placówki radzą sobie lepiej niż tradycyjny, scentralizowany model państwowy.

**Konsekwencje fabularne programu pilotażowego**

- KPI-rudy / leaderboard (patrz: [[Elementy korporacyjne z twistem krasnoludzkim]]) przestaje być tylko ozdobnym UI — to dosłownie sens istnienia programu: porównanie wyników IPA z innymi placówkami (pilotażowymi i/lub tradycyjnym modelem PIWO).
- Audyt zyskuje realną stawkę: to nie rutynowa, zaplanowana kontrola, tylko konsekwencja buntu chłopów-krasnoludów (elementy pańszczyzny, patrz: [[Strajk — brak i jakość piwa (elementy pańszczyzny)]]) — inspektor pojawia się właśnie wtedy, gdy trwa strajk, i to jest decyzja o dalszym istnieniu programu pilotażowego. Wykryty w trakcie buntu = zamknięcie pilotażu, przejęcie placówki przez centralę.
- To daje naturalny fabularny fail-state: zamiast bezdusznego "koniec gry" — "program pilotażowy zamknięty".
- Otwiera pole na napięcie/pokusę: opłaca się kombinować z raportami (podkolorowywać liczby przed wysłaniem do centrali), skoro stawką jest przetrwanie całego eksperymentu, nie tylko własnej pensji Sztygara — mechanika do rozważenia później.

### Elementy korporacyjne z twistem krasnoludzkim

Pomysł: wplecenie korpo-sztampy (stanowiska, żargon, procedury) przerobionej na krasnoludzką modłę.

**Stanowiska**
- CEO → Wielki Sztygar (albo "Kierownik ds. Rozkopu Strategicznego")
- Junior specjalista (gracz na starcie) → Młodszy Sztygar ds. Ekspansji Kopalnianej
- HR → Dział Rekrutacji i Piwosfery (rekrutuje kulki, dba o morale/piwo)
- Marketing → Dział Wizerunku Rudy
- Księgowość → Kantor Krwawej Rudy / Biuro Rachunku Sztolniowego
- Prawnik firmowy → Adwokat od Zawaleń (zajmuje się "wypadkami przy pracy")
- Dział bezpieczeństwa → BHP Podziemne, hasło typu "kask to nie moda, kask to życie"

**Firmowe rytuały/elementy**
- Cykliczny (np. cotygodniowy) raport wydobycia wysyłany "do centrali" — mechanicznie: cel tygodniowy do wykonania, presja korpo.
- KPI-rudy — sarkastyczny licznik "wydajności" porównujący do innych (fikcyjnych) placówek firmy.
- Onboarding nowego krasnoluda — papierkowa broszura "Witaj w rodzinie [Nazwa Firmy]!" zanim dostanie kilof.
- List motywacyjny/CV pisany przez kulkę przed rekrutacją — flavour text.
- Program lojalnościowy piwny — im dłużej krasnolud przeżyje, tym lepsze piwo/beneficja (nawiązanie do stażu pracy).
- Firmowe hasło/motto na banerze w obozie, np. "Kop głębiej. Pij mądrzej." albo "Ruda to przyszłość".
- Audyt — nie jest osobnym, zaplanowanym eventem sprawdzającym jakość piwa; zamiast tego inspektor państwowy pojawia się właśnie wtedy, gdy trwa bunt/strajk chłopów-krasnoludów (elementy pańszczyzny), i wiesza Cię za jaja za dopuszczenie do buntu poddanych — patrz: [[Strajk — brak i jakość piwa (elementy pańszczyzny)]].

### Budynki obozu

- **Karczma** — miejsce, gdzie przesiadują kopacze (werbunek pierwszej kulki odbywa się tu, patrz: początek gry).
- **Kowal** — buduje się tu ulepszenia globalne i produkuje ulepszenia lokalne (per-encja).
- **Obóz werbunkowy** — reguluje limit dostępnych do zespawnowania jednostek (żeby nie było nielimitowanej ilości kulek od startu); z czasem odblokowują się tu nowe rodzaje jednostek oraz rośnie ilość aktualnie dostępnych do zespawnowania.

### Szkoła Górnicza — drzewko badań

- Budynek/system widoczny od początku gry — gracz od razu widzi wszystkie węzły drzewka (część zablokowana/wyszarzona, ale opisana), żeby zawsze miał na widoku cel/kierunek rozwoju.
- Ukończenie węzła może odblokować: nowy typ jednostki, i/lub globalne ulepszenie, i/lub nowy budynek/mechanikę (np. tor, stację).
- Konkretny sposób/warunek odblokowania pojedynczego węzła — jeszcze nieustalony. Rozważane kierunki (do przemyślenia później): kamienie milowe, koszt surowcowy (research), zależności między węzłami (jak w klasycznym tech-tree), albo odblokowanie danej jednostki jako efekt konkretnego wynalazku (np. wynalezienie maszyny do wykrywania złóż odblokowuje jednostkę Skauta).

### Sterowanie i widok

- Sterowanie za pomocą myszki.
- Culling na viewbox (renderować/liczyć tylko to, co w widocznym obszarze — powiązane z systemem ekspozycji bloków, patrz: wymagania techniczne).
- Zoom.

### Minimapa

- Minimapa pokazująca ogólnie całą mapę i co zostało skopane, a co nie.
- 1 piksel = 1 blok to za dużo (przy milionach bloków minimapa wyszłaby ogromna) — trzeba agregować wiele bloków w jeden piksel/kafelek (np. blok NxN, punkt wyjścia 4×4, do dopracowania).
- Agregacja stanu: kilka progów wykopania kafelka (np. 0%, ~25%, ~50%, ~75%, 100%) pokazywane różnymi odcieniami, żeby minimapa czytelnie pokazywała stopień przekopania obszaru, nie tylko binarnie puste/pełne.
- Kolor piksela może brać dominujący typ bloku w kafelku — dzięki temu minimapa pokazuje z grubsza biomy/żyły surowców, nie tylko sam fakt wykopania.
- Skala agregacji: albo stała (np. zawsze 8×8), albo dynamiczna — wyliczana z rozmiaru całej mapy podzielonego przez docelowy rozmiar minimapy w pikselach, żeby UI miało zawsze przewidywalny, stały rozmiar niezależnie od wielkości mapy.
- Możliwe powiązanie z systemem chunków: agregacja per chunk (jeden piksel/kafelek na minimapie = jeden chunk) z prekalkulowanym % wykopania aktualizowanym przy każdym rozbiciu bloku — tanie obliczeniowo, bo nie trzeba przeliczać całej minimapy za każdym razem.

### Fizyka wystrzału i model HP bloków

- Każda klasa krasnoluda ma swoją stałą, docelową prędkość bazową (zależną od klasy).
- Pasek siły przy wystrzale: minimalne pociągnięcie = zawsze bazowa prędkość klasy. Im mocniej pociągniesz pasek, tym większa prędkość początkowa.
- Jeśli strzał był mocniejszy niż baza, kulka z czasem zwalnia z powrotem do swojej docelowej (klasowej) prędkości — czyli siła wystrzału daje tylko chwilowy, szybszy pierwszy przelot, nie trwałą przewagę.
- Szczegóły do dopracowania później (nieustalone): czy zwalnianie jest płynne w czasie (jak opór/tarcie), czy skokowe (np. reset po pierwszej kolizji).
- Bloki mają HP, a krasnoludy zadają obrażenia zależne od swojej klasy (np. Intern ma niski/zerowy dmg do twardszych bloków, Miner radzi sobie ze wszystkimi z odpowiednimi ulepszeniami) — to tłumaczy różnicę "zużycia piwa szybciej przy twardszych blokach": twardszy blok = więcej trafień/dłuższy kontakt potrzebny do zniszczenia.

- Prędkość wpływa na dmg — im szybciej leci kulka, tym więcej obrażeń zadaje przy trafieniu. Dmg skaluje się z aktualną prędkością w danej chwili lotu (nie jest to jednorazowy boost naliczony na starcie) — czyli gdy prędkość spada z powrotem do bazowej (patrz wyżej), dmg też wraca do wartości bazowej. To sprawia, że mocny strzał daje realną przewagę na starcie (może przebić się przez kilka bloków pod rząd, zwłaszcza przy Wiertaczu lecącym po linii), ale efekt naturalnie się wyrównuje w czasie lotu — dzięki temu pasek siły to prawdziwa decyzja taktyczna na strzał, a nie coś, co zawsze warto maksować.

### Siła penetracji (niszczenie bloku)

- Siła penetracji to wartość zależna od dmg (obrażeń) kulki i jej aktualnej velocity w momencie trafienia.
- Porównywana jest do siły bloku (jego odporności), stąd stosunek siła penetracji / siła bloku decyduje o wyniku kolizji:
  - **≥ 1.5x siły bloku** → blok jest rozbity, kulka leci dalej (przebicie bez utraty lotu).
  - **> 1x, ale < 1.5x siły bloku** → blok jest rozbity, ale kulka się odbija.
  - **< 1x, ale > 0.5x siły bloku** → blok nie jest rozbity, zadawany jest dmg równy różnicy między siłą penetracji a siłą bloku, kulka się odbija.
  - **< 0.5x siły bloku** → kulka się odbija, blokowi nic się nie dzieje (brak obrażeń).

### Pomysł na ulepszenie — celność wystrzału

- Wystrzał z platformy (przeciągnięcie i puszczenie) domyślnie ma losowy offset od zadanego kierunku — czyli gracz nie trafia idealnie tam, gdzie celował.
- Ulepszenie: zmniejsza ten losowy offset, czyli poprawia celność wystrzału (im wyższy poziom ulepszenia, tym bliżej zadanego kierunku faktycznie leci kulka).

### Strajk — brak i jakość piwa (elementy pańszczyzny)

- Piwo można rozcieńczać, żeby wystarczyło go na więcej (przetrwanie w ciężkich czasach, gdy brakuje surowców/produkcji), ale to obniża jego jakość.
- Ryzyko: im bardziej rozcieńczone piwo (im gorsza jakość), tym większe ryzyko strajku/buntu wśród krasnoludów.
- Fabularny twist pańszczyźniany: krasnoludy-górnicy traktowane są jak chłopi pańszczyźniani IPA/PIWO — nie ma tu typowego, korpo-poprawnego "audytu jakości" jako osobnego, zaplanowanego wydarzenia. Zamiast tego: jeśli akurat trwa bunt/strajk chłopów-krasnoludów w momencie, gdy pojawia się inspektor państwowy, to on wiesza Cię (Sztygara) za jaja za to, że dopuściłeś do buntu poddanych — czyli event "audytu" jest wywoływany właśnie przez strajk, nie jest niezależnym, osobnym timerem.
- Szczegóły (jak dokładnie liczony jest strajk, jak dokładnie wygląda kara od inspektora, co się dzieje podczas samego strajku) — nieustalone jeszcze.

### Losowe eventy na mapie

- Pomysł: losowe eventy zmieniające dostępność części mapy, np. boss przejmuje ważny tunel i nie ma jak się przez niego dostać dalej, albo podziemna rzeka zalewa tunel i odcina go.
- Nieustalone, do przemyślenia później.

### Koboldy

- Pomysł: koboldy jako swego rodzaju "surowiec"/zasób — łapane na mapie, używane potem jako zwierzątka do różnych rzeczy w kopalni.
- Nieustalone, do przemyślenia później (jakie konkretnie zastosowania, jak się je łapie).

### Krypta — magazyn surowców (zamiast listy w rogu ekranu)

- Zamiast typowej listy surowców w rogu ekranu (jak w wielu innych grach), robimy to bardziej klimatycznie: krypta.
- Krypta to w zasadzie plecak typu grid, ale fizycznie umiejscowiony na mapie (w obozie).
- Surowce da się do niej znosić i z niej wyciągać.

### Ustalone w rozmowie (decyzje, przeniesione też do GDD)

- Sterowanie: gracz ustawia kąt i siłę wystrzału na starcie, potem krasnolud leci sam (bez kontroli w locie).
- Fizyka: swobodne odbicia jak w klasycznym Arkanoidzie — stały wektor prędkości, brak grawitacji.
- Śmierć: gdy piwo się skończy, krasnolud znika na stałe (permadeath), trzeba wychować nowego.
- Liczba jednoczesnych krasnoludów w locie: brak sztywnego limitu na to, ile może ich być naraz w scenie (ograniczeniem "w locie" jest zapas piwa). Osobno: ile jednostek jest dostępnych do zespawnowania w ogóle reguluje obóz werbunkowy (patrz: budynki obozu).
- Zużycie piwa (domyślny wybór, do potwierdzenia): paliwo zużywane w czasie, szybciej przy rozbijaniu twardszych bloków.
- Mapa/wygrana (domyślny wybór, do potwierdzenia): jedna, ogromna, ręcznie zaprojektowana mapa, którą odkopujesz w całości.

---

## System mapy — jak działa i jak z nim pracować

Mapa nie pochodzi z pliku, tylko z generatora (`src/sandbox/mapGen`). Nowa gra = generacja na workerze + od razu zapis; od tej chwili prawdą jest zapis, wczytanie idzie z pliku, bez generatora. Plany i stan prac: `.todo/rework.md`.

### Trzy warstwy

- **Dane** — `World` (`src/sandbox/world/world.ts`): instancja należąca do sceny gry, czyste dane bez reguł, eventów i kamery. Wyjście do menu wyrzuca ją razem ze sceną, wczytanie tworzy nową — nic do resetowania.
- **Symulacja** — zmienia dane, działa niezależnie od kamery, emituje eventy, niczego nie rysuje ani nie gra: `Terrain`, `PhysBall`, `Discovery`.
- **Prezentacja** — pokazuje to, co widać, reaguje na eventy, nie zmienia danych: `ChunkView`, `MapEffects`, `DecoView`.

Zasada: **symulacja nie zależy od kamery, kamera decyduje wyłącznie o prezentacji.** Przechowujemy tylko to, czego nie da się wyliczyć, każdy rodzaj danych w formacie pasującym do jego gęstości.

### Co siedzi w `World`

| pole         | postać                                                           | uwagi                                                       |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `solid`      | gęsta tablica u16, wiersz po wierszu (`gx + gy * szerokość`)     | typ (11 bitów) + wariant grafiki (5 bitów), patrz `tile.ts` |
| `damage`     | rzadka `Map`: indeks kafla → obrażenia (0–`MAX_DAMAGE`)          | uszkodzony jest ułamek procenta kafli                       |
| `decos`      | rzadkie `Map` osobno dla `back` i `front`: indeks kafla → deco   | typ + wariant spakowane jak kafel, najwyżej jedno na warstwę |
| `discovered` | `u8` na chunk                                                    | mgły wojny nie ma, patrz niżej                              |
| `biomes`     | gruba siatka `u8` (komórka `biomeCellInTiles`)                   | `biomeAt(gx, gy)`                                           |
| `meta`       | seed, `origin`, rozmiary kafla / chunka / mapy, `border`         | `origin` = pozycja mapy w świecie (nad kopalnią jest niebo) |

`void` (typ 0) to poza kopalnią (niebo, pustka za ramką), `air` to zawsze wnętrze kopalni. `World.getType` poza mapą zwraca `meta.border`.

Surowe `solid[i]` czyta tylko `World` (`getType`, `getVariant`, `setTile`) — podział bitów jest częścią formatu zapisu. Gorące pętle (fizyka, `ChunkView`) mogą maskować inline, z komentarzem dlaczego.

`World` nie ma w sobie reguł. „Co się dzieje, gdy kulka trafi kafel” to `Terrain`, nie `World`.

### Co gdzie mieszka

W danych mapy trzymasz wyłącznie to, co różni kafel od kafla. Wszystko, co wynika z typu, siedzi w tabelach w `src/sandbox/content/`:

- `blocks.ts` (`BLOCKS`, `getBlock`): `variants` (przycięcia grafiki, indeks = wariant kafla), `collides` (maska „kogo zatrzymuje”), `str` (wytrzymałość), `category`, `resource`, `reveals`.
- `decos.ts` (`DECOS`, `getDeco`): `layer`, `attached` (`self` / `below` / `above`), `permanent`, `clickable`, `area`, zastępczy kolor.
- `objects.ts` (`OBJECTS`): kształt obiektu, `LOOT`.

Konsekwencja: żeby zmienić regułę (np. „kamień jest od teraz twardszy”) edytujesz jedną linijkę, nie regenerujesz map. Do `content/` importuje też worker generatora, więc **nie wolno tam ciągnąć Pragmy ani Aurory**. Dlatego tabele „typ → aktor” (`REVEALED` w `terrain.ts`, `DECO_ACTORS` w `decoView.ts`, `SAVED_ACTORS` w `gameScene.ts`) są w systemach, nie w `content/`.

### Kto czym zarządza

- **`Terrain`** (`systems/game/terrain.ts`) — jedyne miejsce, które zmienia teren według reguł gry: `hit`, `damage`, `mine`, `place`. Trzyma `World` (`addSystem(Terrain, world)`, dostęp przez `scene.getSystem(Terrain).world`). Usuwa też deco zależne od wykopanego kafla.
- **`PhysBall`** — czyta `World` bezpośrednio, nigdy przez załadowane chunki. Kulka poza kadrem normalnie zderza się z mapą i kopie.
- **`Discovery`** — które chunki są odkryte.
- **`ChunkView`** — batche widocznych chunków (tło, kafle, deco), poolowane. Chunk w widoku: zakres z kamery + margines, tylko odkryte (komenda `game.showAllChunks()` pokazuje wszystkie).
- **`MapEffects`** — rysy, błysk, rozpad, iskry i dźwięki po eventach.
- **`DecoView`** — aktorzy deco z zachowaniem (pochodnia).
- **`InteractiveElements`** — klik jedną drogą (niżej).

### Eventy sceny

`tileDamaged`, `tileMined` (po fakcie, kafel jest już powietrzem), `tilePlaced`, `tileRevealed`, `decoRemoved`, `tileClicked`, `decoClicked`, `ballBounced`, `ballEnteredChunk`, `chunkDiscovered`, `chunkShown`, `chunkHidden`, `gameModeChanged`.

Surowce, dźwięki, statystyki po wykopaniu — przez `tileMined`: listener dostaje typ i sam rozstrzyga (ruda z terenu czy zwrot materiałów), więc `Terrain` nie wie nic o surowcach ani dźwięku.

### Jak zrobić rzecz X

**Obiekt z zachowaniem (skrzynia, palisada, pułapka)**

To aktor z komponentami (`Sprite` / `Shape`, `Physics`, `Interactive`...), żyje całą grę niezależnie od kamery (kamera tylko go nie rysuje), stan trzyma w sobie. Brak rekordów obiektów w `World` i brak tabel zachowań.

- Zapis: klasa ma `save(writer): boolean` (false = nic do zachowania) i `static load(reader)`, rejestracja w `GameScene.SAVED_ACTORS` (numerów nie zmieniać). `capture()` przechodzi po aktorach sceny, `restore()` je spawnuje.
- Kolizja: `Physics` (static lub trigger, koło lub obrócony prostokąt). Przelot kulki przez trigger daje actor event `triggerEntered`.
- Klik: `Interactive` → actor event `clicked`.

**Kafel-niespodzianka (ukryta skrzynia, ul)**

Blok z `reveals: ObjectsID`. Pierwsze trafienie: kulka się odbija, kafel staje się powietrzem, `Terrain` spawnuje aktora z tabeli `REVEALED` i emituje `tileRevealed`. Nowy rodzaj = wpis w `REVEALED` plus aktor.

**Coś niezniszczalnego**

Nie ma osobnego mechanizmu — ogromny `str`, jak obsydian. `strike` liczy stosunek siły do wytrzymałości, nigdy nie dobija progu i kulka się odbija.

**Dekoracja**

Dane są prawdą, a aktor tylko widokiem — nie ma życia poza ekranem (kulka go nie trąca, nic nie symuluje).

- Zwykłe deco (grzyb, stalaktyt): wpis w `DECOS`, generator stawia je w pass `mapGen/passes/decos.ts` według `attached`, szansy i głębokości z `MAP_GEN_CONFIG.decos`. Rysuje je batch chunka.
- Deco z zachowaniem (pochodnia): dodatkowo wpis w `DECO_ACTORS`. `DecoView` spawnuje aktora na `chunkShown` i usuwa na `chunkHidden` / `decoRemoved`. Aktor **nie trzyma trwałego stanu** — co ma przetrwać, pisze do danych deco.
- Znika razem z kaflem: nie-`permanent` deco jest usuwane przez `Terrain`, gdy wykopany zostanie kafel, od którego zależy (`DEPENDENTS`); event `decoRemoved` jest pod efekty.

**Klik**

Jedna droga w `InteractiveElements`, od najbliższego widza: deco przednie → aktorzy z `Interactive` → deco tylne → kafel. Deco łapie klik tylko z `clickable` i w swoim `area`. Kafel i deco dostają eventy sceny `tileClicked` / `decoClicked`, aktor dostaje actor event `clicked`.

**Coś ruchomego (wagon, potwór, kulka)**

Nie jest kaflem ani deco. Bajt nie zmieści stanu „jestem w 40% trasy i wiozę 12 żelaza” — to aktor/encja. Kryterium: czy cały stan mieści się w kaflu? Jeśli tak, dane plus odtwarzalny widok. Jeśli nie, aktor.

**Postęp budowy / naprawy**

Plac budowy to obiekt dynamiczny: aktor, który sam tyka niezależnie od kamery. Nie licz postępu „przy następnym pokazaniu chunka”, bo pokazywanie jest sterowane kamerą i budowa stałaby, kiedy nie patrzysz.

### Chunki w widoku

`ChunkView` liczy zakres chunków z viewboxa kamery, dokłada margines i synchronizuje: oddaje do puli to, co wypadło, i bierze z puli to, czego brakuje (emituje `chunkHidden` / `chunkShown`). Chunk w puli jest przepinany na nowy indeks, nie kasowany.

Wczytanie i wyładowanie nie niosą stanu: cała prawda siedzi w `World`, chunk to okno na nią. Wjazd kamerą tam i z powrotem daje ten sam chunk ze zniszczeniami. `World.chunkVersions` (tylko w pamięci) rośnie, gdy zmieni się typ kafla lub deco w chunku, i mówi widokowi, że batch trzeba przebudować.

### Odkrywanie chunków

Chunk jest odkryty, gdy kulka w nim była albo jest sąsiadem chunka, w którym jest kulka (`Discovery`, na `ballEnteredChunk`). Monotonicznie — raz odkryty, zawsze odkryty. Wchodząc w chunk, kulka odkrywa też ośmiu sąsiadów, więc nigdy nie wyprzedza odkrytego obszaru.

Mgły wojny i fali odkrycia już nie ma (usunięte jako brzydkie, kopia w `git stash`). Odkryty chunk po prostu się pojawia. Fizyka działa tak samo na odkrytych i nieodkrytych.

### Zapis gry

Jeden plik `.sav` z sekcjami, w `gameData/saves/<gameId>/` (dev: repo, prod: `userData`). Renderer nigdy nie dotyka dysku, tylko IPC (`src/backend/IPC/saves.ts`). Zapis atomowy: plik tymczasowy + rename.

- Nagłówek: magic `KRSN` + wersja formatu. Sekcja: `id u16, wersja u16, długość u32, payload` — nieznaną sekcję można pominąć, wersja sekcji pozwala na migrację. `meta` jest pierwsza, bo menu czyta tylko nagłówek i nazwę.
- Sekcje (`saveFormat.ts`, **numerów nigdy nie zmieniać ani nie używać ponownie**): 1 meta, 2 terrain, 3 damage, 4 discovered, 5 biomes, 7 resources, 9 actors, 10 decos. Sekcje 6 (objects) i 8 (dwarfs) wycofane — stare zapisy wczytują się bez krasnoludów i skrzyń, migracji nie ma.
- Kodek (`saveCodec.ts`) nie zna aktorów: sekcja `actors` to `kind u16, długość u32, bajty` na aktora, resztę robi `GameScene.capture()` / `restore()`.
- Model w pamięci jest oddzielony od kodeka: zmiana formatu to kilka funkcji, nie przebudowa gry.
- Zapis zamiast seed + diff: seed + diff łamie zapisy przy każdej zmianie generatora. Seed zostaje w `meta` do rzeczy wyliczanych.

Komendy w profilerze: `game.save(name?)`, `game.saves()`, `game.load(gameId?, file?)`, `game.newGame(seed?, chunksWide?, chunksHigh?)`, `game.check()` (zapis, odczyt z dysku, porównanie ze światem w pamięci). Po zmianie formatu lub dowolnej sekcji uruchom `game.check()`.

### Pułapki, o których łatwo zapomnieć

- Bity `solid` (11 typ / 5 wariant) są częścią formatu zapisu. Zmiana podziału = migracja sekcji `terrain`.
- Wariant spoza tabeli (zapis ze starszej wersji) nie może wywalić gry — `getVariantCrop` ma fallback na wariant 0. Czytaj grafikę przez niego, nie przez `variants[variant]`.
- Plik w `content/`, który zaimportuje Pragmę, Aurorę albo cokolwiek z ekranu, zepsuje build workera generatora. Błąd wychodzi dopiero przy `pnpm package`.
- `Terrain.place` nie rusza deco (stawianie kafli przez gracza i tak jest wyłączone — `MapBuilder` stawia palisady). Gdy wróci stawianie kafli, trzeba zdecydować, co z deco na zajętym kaflu.
- Alfa 255 albo utrata porządku głębi. Sprite z alfą inną niż 255 trafia do batcha przezroczystego, który ma wyłączony zapis głębi i leci po wszystkim nieprzezroczystym. Jedna warstwa z alfą 254 wyląduje nad całą mapą.
- `z` nie bierze udziału w sortowaniu — sortowanie idzie po Y. Kolejność warstw robi wyłącznie test głębi, greater-equal, czyli wygrywa większe `z`.
- Współrzędne. `gx`/`gy` to kafel w całej mapie (lokalne dla mapy, nie dla świata), `lx`/`ly` to kafel wewnątrz chunka, `cx`/`cy` to chunk. Konwersje świat↔kafel↔chunk idą przez `World` (`worldToTile`, `tileToWorld`, `chunkOfTile`...), bo tylko on zna `origin` mapy.
- Shadery WGSL kompilują się dopiero w grze — błąd widać dopiero w konsoli.

---

## Pytania otwarte (skopiowane z GDD, do rozwijania)

- Czy krasnoludy w locie kolidują ze sobą nawzajem?
- Ile typów bloków/surowców na start (MVP) vs. pełna wersja?
- Transport surowców — automatyczny czy wymaga logistyki?
- Zagrożenia w kopalni — potwory/lawa/zawalenia czy tylko zużycie piwa?
- Layout obozu — fizyczna mapa budynków czy menu ulepszeń?
- Progres offline/idle czy gra wyłącznie aktywna?
- Skala mapy — orientacyjne wymiary w blokach?
- Platforma docelowa (przeglądarka/mobile/desktop)?
