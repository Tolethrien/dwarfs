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

### Strajk — brak i jakość piwa

- Piwo można rozcieńczać, żeby wystarczyło go na więcej (przetrwanie w ciężkich czasach, gdy brakuje surowców/produkcji), ale to obniża jego jakość.
- Ryzyko: im bardziej rozcieńczone piwo (im gorsza jakość), tym większe ryzyko strajku wśród krasnoludów.
- Szczegóły (jak dokładnie liczony jest strajk, co się dzieje podczas strajku) — nieustalone jeszcze.

### Losowe eventy na mapie

- Pomysł: losowe eventy zmieniające dostępność części mapy, np. boss przejmuje ważny tunel i nie ma jak się przez niego dostać dalej, albo podziemna rzeka zalewa tunel i odcina go.
- Nieustalone, do przemyślenia później.

### Koboldy

- Pomysł: koboldy jako swego rodzaju "surowiec"/zasób — łapane na mapie, używane potem jako zwierzątka do różnych rzeczy w kopalni.
- Nieustalone, do przemyślenia później (jakie konkretnie zastosowania, jak się je łapie).

### Ustalone w rozmowie (decyzje, przeniesione też do GDD)

- Sterowanie: gracz ustawia kąt i siłę wystrzału na starcie, potem krasnolud leci sam (bez kontroli w locie).
- Fizyka: swobodne odbicia jak w klasycznym Arkanoidzie — stały wektor prędkości, brak grawitacji.
- Śmierć: gdy piwo się skończy, krasnolud znika na stałe (permadeath), trzeba wychować nowego.
- Liczba jednoczesnych krasnoludów w locie: brak sztywnego limitu na to, ile może ich być naraz w scenie (ograniczeniem "w locie" jest zapas piwa). Osobno: ile jednostek jest dostępnych do zespawnowania w ogóle reguluje obóz werbunkowy (patrz: budynki obozu).
- Zużycie piwa (domyślny wybór, do potwierdzenia): paliwo zużywane w czasie, szybciej przy rozbijaniu twardszych bloków.
- Mapa/wygrana (domyślny wybór, do potwierdzenia): jedna, ogromna, ręcznie zaprojektowana mapa, którą odkopujesz w całości.

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
