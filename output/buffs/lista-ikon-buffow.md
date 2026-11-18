# Ikony buffów — Krasnokopalnia

## Ustalenia graficzne

- Bazowy rozmiar: **96 × 96 px razem z ramką**; zgodny z bazowym rozmiarem elementów świata gry. Rozmiar wyświetlania można później zmienić.
- Styl: grube, nieregularne ciemne kontury, malowane faktury, ciemne kamienne tło i postarzana metalowa ramka, spójne z ikonami zasobów.
- Duża, czytelna sylwetka przedmiotu i jeden dominujący efekt. Bez napisów wewnątrz ikon.
- Próbka kierunku: `thunder-pickaxe-96.png` w tym katalogu. Zatwierdzony jest rozmiar; szczegóły stylu całego zestawu można dopracować.
- Badania: księgi i błękitne runy. Finanse: złoto i czerwony lak. Zapasy: drewno, stalowe obręcze i bursztynowe piwo.
- Motyw fabularny: górnicza biurokracja PIWO / IPA — pieczęcie, dekrety, normy wydobycia i benefity w kuflach.
- Poniższe działania są propozycjami projektowymi, nie opisem zaimplementowanych mechanik. Lista obejmuje 100 ikon. Pozycje 66–100 uzupełniają motywy z `../dwarfs-exp/.GDD`, w tym mechaniki nadal rozważane.
- Aktualny arkusz: **`buffs-100-96.png`, 960 × 960 px**, siatka 10 × 10, każda komórka 96 × 96 px; 100 ikon w kolejności poniżej, od lewej do prawej, wierszami. Brak pustych komórek.
- Współrzędne, nazwy i propozycje efektów: `buffs-100-96.json`. Identyfikatory `buff-001`–`buff-065` zachowano, ale współrzędne zmieniły się wskutek przejścia z 9 do 10 kolumn.
- Poprzedni arkusz 65 ikon: `buffs-96.png` i `buffs-96.json`. Pierwsze 65 ikon w nowym arkuszu zachowuje identyczne piksele.
- Źródła generacji: `buffs-source.png` oraz `buffs-extension-source.png`; prompty: `spritesheet-prompt.txt` oraz `extension-prompt.txt`. Generator: wbudowany imagegen. Siatki źródłowe wyrównano do komórek 96 × 96 px.

## Pełna lista

| Nr | Nazwa | Motyw ikony | Proponowane działanie |
|---|---|---|---|
| 1 | Górniczy zapał | Kilof z żółtymi smugami ruchu | Szybsze kopanie |
| 2 | Kruszyciel skał | Ciężki kilof rozłupujący kamień | Większa siła wydobycia |
| 3 | Diamentowe ostrze | Kilof z błękitnym ostrzem i odpryskami | Łatwiejsze przebijanie twardych skał |
| 4 | Piorunujący kilof | Żelazny kilof opleciony błyskawicami | Szansa na dodatkowe uderzenie |
| 5 | Żar głębin | Kilof z pomarańczowymi pęknięciami | Obrażenia od ognia |
| 6 | Runiczne uderzenie | Kilof z fioletowymi runami | Mocniejsze uderzenie co kilka zamachów |
| 7 | Drugie śniadanie | Spieniony kufel z unoszącymi się bąbelkami | Regeneracja energii |
| 8 | Piwo siłacza | Kufel z mocarnym uchem i czerwoną poświatą | Większa siła |
| 9 | Złoty lager | Złoty kufel z monetami w pianie | Więcej złota z wydobycia |
| 10 | Lodowy porter | Ośnieżony kufel z błękitnymi bąbelkami | Odporność na gorąco |
| 11 | Grzybowy ale | Kufel z zieloną pianą i małym grzybem | Odporność na trucizny |
| 12 | Ostatnia kolejka | Dwa stukające się kufle, rozprysk piany | Wzmocnienie pobliskich krasnoludów |
| 13 | Żelazna skóra | Nitowany napierśnik ze srebrnym błyskiem | Większy pancerz |
| 14 | Kamienna pierś | Pancerz z grubych kamiennych płyt | Redukcja otrzymywanych obrażeń |
| 15 | Runiczna osłona | Napierśnik otoczony niebieskimi runami | Tymczasowa tarcza |
| 16 | Żaroodporna zbroja | Ciemny napierśnik z płomieniami przy krawędzi | Odporność na ogień |
| 17 | Cierniowe nity | Pancerz z krótkimi stalowymi kolcami | Odbijanie części obrażeń |
| 18 | Szczęśliwy hełm | Hełm z koniczyną i złotą iskierką | Mniejsza szansa na uraz |
| 19 | Chyże buciory | Ciężkie buty ze smugami kurzu | Szybszy ruch |
| 20 | Pewny krok | Podkuty but wbity w pękniętą skałę | Odporność na odrzucenie |
| 21 | Mocny chwyt | Skórzana rękawica zaciśnięta na trzonku | Szybsza praca narzędziami |
| 22 | Plecy tragarza | Wypchany plecak z rudą i strzałką w górę | Większy udźwig |
| 23 | Rozpędzony wózek | Wózek z rudą i iskrami spod kół | Szybszy transport |
| 24 | Dobrze naoliwione | Oliwiarka nad złotym kołem zębatym | Szybsza praca maszyn |
| 25 | Oko poszukiwacza | Lupa nad błyszczącą żyłą złota | Częstsze znajdowanie cennych rud |
| 26 | Kryształowy rezonans | Błękitny kryształ z rozchodzącymi się falami | Więcej wydobywanych klejnotów |
| 27 | Światło przodków | Górnicza latarnia ze złotą aureolą | Większy zasięg widzenia |
| 28 | Solidna obudowa | Drewniana podpora z metalowymi obejmami | Ochrona przed zawałami |
| 29 | Wybuchowa robota | Wiązka dynamitu z iskrzącym lontem | Większy obszar niszczenia skał |
| 30 | Róg sztygara | Mosiężny róg z czerwonym sztandarkiem | Szybsza praca całej załogi |
| 31 | Większe bum | Pękata bomba na tle pomarańczowej eksplozji | Większy promień wybuchu |
| 32 | Ładunek przebijający | Stalowa bomba z ostrym czubkiem, wbita w skałę | Większe obrażenia wybuchowe przeciw twardym blokom |
| 33 | Reakcja łańcuchowa | Trzy laski dynamitu połączone iskrzącym lontem | Wybuch wywołuje dodatkowe, mniejsze detonacje |
| 34 | Demolka z opóźnieniem | Bomba z mosiężnym zegarem i żarzącym lontem | Mocniejszy wybuch po odliczeniu |
| 35 | Wybuchowe odbicie | Nitowany hełm odbijający się od skały, za nim błysk eksplozji | Kilka kolejnych zderzeń krasnoluda powoduje małe wybuchy |
| 36 | Proch z centrali | Beczka prochu z czerwoną pieczęcią i iskrami | Silniejsze ładunki dla wszystkich Demolek |
| 37 | Norma przekroczona | Bryła rudy pod złotą strzałką wystrzeloną w górę | Chwilowo większy uzysk z wydobycia |
| 38 | Podpisano. Kopać. | Wielki mosiężny stempel uderzający w pergamin | Szybsza praca całej załogi |
| 39 | Budżet zatwierdzony | Rozwiązany worek monet z woskową pieczęcią | Tańsza budowa torów, stacji i platform |
| 40 | Płynność finansowa | Kufel przelewający piwo na stos monet | Korzystniejsza wymiana surowców |
| 41 | Pakiet benefitów | Kufel przewiązany czerwoną wstążką | Przydzielone piwo wystarcza krasnoludom na dłużej |
| 42 | Przyspieszony onboarding | Hełm na zwiniętej broszurze, obok dwie smugi ruchu | Szybsze uzupełnianie dostępnych rekrutów |
| 43 | Synergia działów | Dwa zazębione koła: jedno z kilofem, drugie z kuflem | Większy zasięg buffa nakładanego przez Tragarza |
| 44 | Obieg dokumentów | Skrzydlaty pergamin z pieczęcią w kształcie wagonika | Krótszy czas dotarcia wydobytych surowców do stacji |
| 45 | Dekret pięcioletni | Królewski zwój ze złotą koroną i skrzyżowanymi kilofami | Silna premia do wydobycia wybranego surowca |
| 46 | Akademia Kilofa | Otwarta księga ze skrzyżowanymi kilofami | Szybsze prowadzenie badań |
| 47 | Olśnienie pod ziemią | Kryształ świecący nad otwartą księgą | Dodatkowe punkty badań przy odkrywaniu złóż |
| 48 | Geologia stosowana | Lupa nad przekrojem skały z kolorowymi żyłami | Skuteczniejsze wydobycie przebadanych minerałów |
| 49 | Doktorat z rozbijania | Biret z małym kilofem zamiast chwosta | Większa siła uderzeń wyszkolonych górników |
| 50 | Praktyki zawodowe | Mały i duży kilof na tle pergaminu | Szybsze szkolenie Internów |
| 51 | Notatki starego sztygara | Zużyty notes, ołówek i zakładka z runą | Niższy koszt kolejnego badania |
| 52 | Mechanika odbić | Mosiężny kątomierz i kulka ze strzałkami odbicia | Większa celność wystrzału |
| 53 | Badania terenowe | Skórzana torba z próbkami skał i zwojem | Punkty badań za odkrywanie nowych obszarów |
| 54 | Patent kopalniany | Zapieczętowany schemat koła zębatego | Większa wydajność maszyn |
| 55 | Stypendium PIWO | Księga, sakiewka i mały spieniony kufel | Tańsze badania i szkolenia |
| 56 | Złota rezerwa | Trzy ciężkie sztabki ze złotym błyskiem | Większa produkcja monet w mennicy |
| 57 | Żelazny sejf | Nitowany sejf z wielkim pokrętłem | Większa pojemność magazynu monet |
| 58 | Procent składany | Stos rosnących monet otoczony okrężną strzałką | Okresowa premia zależna od zgromadzonych oszczędności |
| 59 | Twarde negocjacje | Krasnoludzka dłoń ściskająca sakiewkę | Korzystniejsze ceny zakupu surowców |
| 60 | Kontrakt stulecia | Pergamin ze złotą pieczęcią i monetami | Większe nagrody za kontrakty |
| 61 | Pełne beczki | Dwie okute beczki z obfitą pianą | Większa produkcja piwa |
| 62 | Zapasy strategiczne | Zamknięta beczka pod małą metalową tarczą | Wolniejsze zużywanie zapasów piwa |
| 63 | Krypta bez dna | Uchylone drzwi krypty, za nimi skrzynie i sztabki | Większa pojemność magazynu zasobów |
| 64 | Dostawa hurtowa | Skrzynia z rudą, beczka i gruba lina spinająca ładunek | Większa pojemność wagoników |
| 65 | Nic się nie zmarnuje | Bryłki rudy i metalowe ścinki otoczone strzałkami | Szansa na odzyskanie części surowców zużytych na budowę |
| 66 | Momentum | Stalowa kulka przebijająca trzy kamienne płytki ze złotą smugą | Przebijanie bloków dzięki rozpędowi |
| 67 | Ciężko mnie zatrzymać | Żelazna kula z czerwonym ogonem iskier | Wolniejsza utrata dodatkowej prędkości |
| 68 | Naciąg mistrzowski | Drewniana proca z napiętą skórą i błyskiem | Większa prędkość początkowa |
| 69 | Szychta pod kontrolą | Mosiężny zegar na tabliczce harmonogramu | Premia do zaplanowanych wystrzałów |
| 70 | Pierwszeństwo przejazdu | Chorągiewka sztygara nad rozjazdem torów | Priorytet obsługi stacji lub transportu |
| 71 | Zmiana bez przestoju | Dwa hełmy otoczone okrężnymi strzałkami | Sprawniejsza rotacja załogi |
| 72 | Zasłużona drzemka | Hełm na miękkiej poduszce | Szybsza regeneracja zmęczenia |
| 73 | Autorytet sztygara | Hełm z czerwonym grzebieniem i mosiężną odznaką | Wzmocnienie związane z obecnością sztygara |
| 74 | Ekspres do przodka | Kabina windy ze smugami w dół | Szybszy dojazd do pracy |
| 75 | Dodatkowa kabina | Dwie kabiny na grubej linie | Większa pojemność windy |
| 76 | Droga wolna | Zwrotnica z zieloną lampą | Większa przepustowość szlaku |
| 77 | Pogotowie torowe | Klucz i młotek nad pękniętą szyną | Naprawy po awarii lub sabotażu |
| 78 | Rozpalony tygiel | Tygiel wylewający pomarańczowy metal | Szybsze przetapianie |
| 79 | Oszczędny palacz | Węgiel z intensywnym złotym płomieniem | Mniejsze zużycie paliwa |
| 80 | Czysty wytop | Srebrzysta sztabka w ciemnym żużlu | Większy uzysk z rudy |
| 81 | Mistrzowski stop | Dwukolorowa sztabka ze świetlistym połączeniem | Rafinacja i zaawansowane materiały |
| 82 | Rzemieślniczy kolektyw | Trzy młotki nad kowadłem | Sprawniejsza realizacja zadań izby |
| 83 | Zamówienie legendarne | Szczypce trzymające fioletowy napierśnik | Wyjątkowy ekwipunek sztygarów |
| 84 | Chmielowa esencja | Szyszka chmielu z bursztynową kroplą | Wzmocnienie głównego efektu receptury |
| 85 | Woda z głębin | Błękitna kropla z kryształkami minerałów | Mineralizacja piwa |
| 86 | Zimne warzenie | Lód obejmujący miedzianą kadź | Receptury wykorzystujące lód |
| 87 | Bukiet jaskiniowy | Świecący kwiat, grzyb i jagody | Akcenty zbierane w biomach |
| 88 | Dębowe leżakowanie | Beczka z liściem dębu i klepsydrą | Premie zależne od wyboru beczki |
| 89 | Happy hour | Kufel premium z zegarem i promieniami | Globalny buff po uwarzeniu piwa premium |
| 90 | Kredyt zaufania | Beczka i zwój z bankową pieczęcią | Pożyczka lub korzystniejsze warunki kredytu |
| 91 | Wakacje od rat | Klepsydra z otwartym łańcuchem | Czasowe odroczenie spłaty |
| 92 | Ulga królewska | Korona nad pergaminem i sakiewka z tarczą | Niższy podatek |
| 93 | Lokata beczkowa | Beczka z kłódką i złotymi kufelkami | Zysk z zamrożonego piwa |
| 94 | Kupiecka karawana | Obładowany wóz z daszkiem i latarnią | Specjalna dostawa lub przyjezdny kupiec |
| 95 | Audyt na medal | Medal z kuflem na czerwonej wstędze | Premia po pozytywnej inspekcji |
| 96 | Kanarek na szychcie | Żółty kanarek w górniczej klatce z nutką | Morale i ostrzeganie przed zagrożeniami |
| 97 | Pajęczyny mi niestraszne | Kulka rozrywająca pajęczynę | Odporność na spowolnienie |
| 98 | Flara zwiadowcy | Czerwona flara rozcinająca ciemną mgłę | Odkrywanie mapy |
| 99 | Polisa od nieszczęść | Pergamin z tarczą, płomieniem i pękniętą szyną | Ograniczanie strat po zdarzeniach |
| 100 | Czujna warta | Hełm strażnika nad kluczami i czerwone oko w cieniu | Ochrona przed kradzieżą i sabotażem |
