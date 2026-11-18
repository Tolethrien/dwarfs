# Warstwy krasiokulek: skrypty i sposób pracy

Skrypty PowerShell + System.Drawing (w systemie nie ma Pythona z PIL). Uruchamianie:

```
powershell -ExecutionPolicy Bypass -File output/dwarf-original-96/scripts/<skrypt>.ps1 [parametry]
```

## Układ folderów

- `finished/`: gotowe warstwy 96×96 na wspólnym płótnie: `body.png` (ciało), `beard-*.png` (zarost w szarości, z brwiami).
- `dwarf-layers.png` + `dwarf-layers.json`: spritesheet z `finished/` (rząd 1 ciało, rząd 2 brody).
- `body-guide/`: materiały robocze:
  - `gen-3e.png`: ciało w pełnej rozdzielczości (1254×1254), **baza do każdej edycji w Codexie**,
  - `reference-768.png`: wzór stylu (podgląd ubranego krasnoluda ×8),
  - `body-mask.png`: mapa regionów ciała 96×96 (tułów/głowa/ręce/dłonie), potrzebna do `-cover torso`,
  - tu lądują robocze `gen-*.png` z Codexa i wyniki wycinania (`*-96/-8x/-tints/-preview.png`); po przeniesieniu wybranych warstw do `finished/` można je kasować.

## Która warstwa jakim trybem

Gotowe prompty dla każdego typu warstwy (wklejane Codexowi): [PROMPTS.md](PROMPTS.md).

| warstwa | plik w `finished/` | wycinanie |
|---|---|---|
| zarost (z brwiami) | `beard-<nazwa>.png` | `extract-layer.ps1 -source … -name beard-<nazwa>-<n> -gray` |
| strój / pancerz | `armor-<nazwa>.png` | `extract-layer.ps1 -source … -name armor-<nazwa>-<n> -cover torso` |
| rękawice | `gloves-<nazwa>.png` | `extract-layer.ps1 -source … -name gloves-<nazwa>-<n> -cover hands` |
| hełm | `helmet-<nazwa>.png` | `extract-layer.ps1 -source … -name helmet-<nazwa>-<n>` |
| narzędzie (jeszcze nie robione) | `tool-<nazwa>.png` | jak hełm; do tego `hand-*.png` = pięść z ciała nad narzędziem |

## Checklista przy nowych wariantach (zarosty, stroje, twarze, skóra)

Cel: dużo różnorodności, ale każda warstwa musi pasować do każdej innej. Przy każdym nowym wariancie sprawdzam:

**Przed promptem**
- Przedrostek pliku i tryb wycinania z tabeli wyżej.
- Co zasłania co (kolejność: body → armor → beard → tool → hand → gloves → helmet). Znak rozpoznawczy stroju musi być widoczny pod brodą, czyli na brzuchu/pasie, nie na piersi. Nic ważnego pod daszkiem hełmu.
- Kolor dominujący klasy (lista w `.todo/krasnoludy.md`), żeby nowy wariant nie zlewał się z istniejącymi.

**Ocena wyniku Codexa**
- Sylwetka (alfa) taka jak w `gen-3e.png`, ręce i bliższa pięść na miejscu, pięść zamknięta.
- Czy nie przemalował twarzy/ucha. `-cover` chroni głowę, hełm (bez trybu) nie.
- Warstwa na magencie: dziury, okruchy, cienkie paski przemalowanego obrysu, jasne piksele na krawędzi (te ostatnie poprawia użytkownik w GIMP).
- **Skóra wewnątrz warstw innych niż `body`** (np. dekolt `armor-intern`, brzeg kołnierza). Dziś nie przeszkadza, ale przy innych kolorach skóry zostanie w starym kolorze. Takie piksele mają być przezroczyste.
- Podgląd z każdą brodą/strojem/hełmem i w skali 1:1 (96 px, tak jak w grze), nie tylko w powiększeniu. Stroje oceniać też na ciemnej skórze (`body-*-dark.png`): dziury i skóra w warstwie widać dopiero tam.
- Warstwy szare (zarost): kilka kolorów, w tym bardzo ciemny i bardzo jasny, na jasnej i ciemnej skórze.

**Nowe twarze**
- Wszystkie brody i hełmy są dopasowane do geometrii twarzy z `body.png`. Nowa twarz MUSI zostawić na miejscu: oczy, łuk brwiowy, nos (ten sam obszar), usta, ucho, podbródek, linię szyi i kontur dalszego policzka. Zmieniamy rysy: kształt nosa w tym samym obszarze, zmarszczki, blizny, wiek, wyraz twarzy, kształt oczu.
- Każdą nową twarz sprawdzam z każdą brodą (brwi leżą na łuku, wąs pod nosem, usta w szczelinie) i z hełmami (daszek nad brwiami).
- Twarz = nowy wariant ciała `body-<nazwa>.png`: Codex edytuje tylko twarz w `gen-3e.png`, `extract-layer.ps1 -cover head` składa z tego gotowe ciało na tej samej sylwetce.

**Kolory skóry**
- Robimy skryptem `recolor-skin.ps1`, nie Codexem: geometria i cieniowanie zostają identyczne.
- Przemapowanie obejmuje całą skórę: twarz, uszy, ręce, dłonie, łącznie z czerwienią nosa i policzków. Oczy i obrys zostają.
- Przed tym trzeba usunąć skórę z innych warstw (patrz wyżej). Nakładkę `hand-*` brać z ciała w tym samym kolorze skóry.
- Sprawdzić kontrast szarych bród i obrysu na skórze bardzo jasnej i bardzo ciemnej.

## Jak powstaje nowa warstwa (zarost, pancerz, rękawice, hełm…)

1. Codex **edytuje** `gen-3e.png` (tryb edit/inpaint, nie generowanie od nowa) i dokłada **jedną** rzecz. Drugi załącznik to `reference-768.png` jako wzór stylu.
2. `extract-layer.ps1` porównuje wynik z bazą i wycina to, co się zmieniło, jako warstwę 96×96 ułożoną dokładnie na ciele.
3. Poprawki pojedynczych pikseli robimy ręcznie (GIMP), gotowy plik trafia do `finished/`.
4. `build-sheet.ps1` składa spritesheet i `dwarf-layers.json` ze wszystkiego, co jest w `finished/`.

### Zasady promptu (wypracowane, działają)

- „EDIT the first image… Change NOTHING else”. Każ zachować piksel w piksel: skórę, oczy, uszy, obrys, białe tło, rozmiar i kadr.
- Elementy do barwienia (zarost) maluj **neutralną stalową szarością**, bez czystej bieli. Szarość odcina się od skóry, więc wycięcie jest czyste, a styl i tak bierze się z referencji.
- „Do NOT paint shadows of the hair onto the skin”. Cień na skórze nie należy do warstwy.
- Bokobrody i krawędzie przy hełmie: „end in a soft tapered tuft, do NOT cut with a flat straight edge”.
- Zero metalu, koralików i skóry w zaroście (zabarwiłyby się razem z włosem). Ozdoby to osobna warstwa.
- Elementy nie wychodzą poza sylwetkę ciała, żeby kulka została kulką.
- Zawsze edytuj czyste ciało, nie wynik poprzedniej warstwy. Rób 2 podejścia, nazwy plików zawsze nowe (`gen-<warstwa>-<n>.png`).

Szkielet promptu (sprawdzony na zarostach):

```
EDIT the first image: add <element> to this bald, clean-shaven dwarf. Change NOTHING else.
<opis kształtu>
COLOR: paint ALL <element> in neutral steel GREY (no red, no brown, no warm tint). Full value range from dark grey
shadows to light grey highlights, but NO pure white pixels. The grey must clearly contrast with the skin everywhere.
STYLE: exactly the art style of the second image. Hand-drawn chunky pixel art, irregular dark outline,
rough grainy painterly texture, same pixel size and same grain as the rest of the first image.
Do NOT paint shadows onto the skin. Keep EVERYTHING ELSE pixel-identical: skin, eyes, nose, ear, skull, arms, hands,
belly, outline, white background, image size and framing. No helmet, no hat, no clothes, no armor.
```

## Skrypty

### `extract-layer.ps1`

```
extract-layer.ps1 -source body-guide/gen-beard-x.png -name beard-x -gray
```

Wycina warstwę z obrazu po edycji. Zapisuje do `body-guide/`: `<name>-96.png` (warstwa), `<name>-8x.png` (powiększenie), `<name>-tints.png` (podgląd na ciele w 5 kolorach, tylko z `-gray`).

- Mapowanie 1254 → 96 bierze z `gen-3e.png` i sylwetki `finished/body.png`, więc warstwa zawsze leży na ciele.
- Piksel trafia do warstwy, gdy różni się od bazy o więcej niż `-threshold` (domyślnie 70, suma |ΔR|+|ΔG|+|ΔB|).
- `-gray`: zamiana na szarość (najjaśniejszy włos = 245) i rozpoznawanie włosa. Włos to piksel wyraźnie mniej nasycony niż skóra pod nim. Ciemny kontur liczy się tylko przy włosie. Ciepłe, przemalowane piksele skóry (cień) odpadają.
- Sprzątanie: odpadają cienkie paski i okruchy (przemalowany przez Codexa obrys ciała). Dziury do 4 px w środku zarostu są wypełniane.
- `-cover torso` (pancerze): cały tułów z maski `body-guide/body-mask.png` trafia do warstwy bez porównania (cień skóry na dole brzucha ma kolor jak skórzany strój i porównanie robi tam dziury), głowa jest zawsze pomijana (Codex lubi przemalować ucho/brwi), ręce i dłonie po staremu z porównania (rękawy). Maska: tułów `171,157,84`, głowa `84,137,171`, ramię `212,89,100`, dłonie `84,88,171`, obrys `210,21,37`; kark za dalszym policzkiem jest już przepisany do tułowia.
  Potem sprzątanie pod inne kolory skóry: (1) piksele w kolorze skóry na dolnym brzegu rękawa, tuż nad gołą ręką, odpadają (Codex maluje tam jasną skórę, na ciemnej wychodzi pomarańczowy pasek); (2) zamknięte dziury do 60 px i wcięcia przy krawędzi (piksel ciała z ≥5 z 8 sąsiadów w warstwie) są wypełniane średnią z sąsiadów. Skrypt wypisuje, ile pikseli zabrał i dodał. Szerokich, otwartych szczelin nie łapie, te poprawia się ręcznie (`apply-cuts.ps1`).
- `-cover head` (nowe twarze): bierze tylko zmiany wewnątrz regionu głowy z maski (bez obrysu sylwetki). Oprócz warstwy zapisuje `<name>-body.png` = `finished/body.png` z podmienionymi pikselami twarzy, czyli gotowy wariant ciała; `fit-body.ps1` nie jest do tego potrzebny.
- `-cover hands` (rękawice): bierze tylko zmiany na rękach/dłoniach z maski i do 2 px wokół nich; głowa i tułów są ignorowane, więc przemalowana twarz czy brzuch nie wejdą do warstwy.
- Bez `-gray` wycina w kolorze (pancerze, hełmy, narzędzia): wszystko, co się zmieniło, z tym samym sprzątaniem pasków i dziur. Zamiast `-tints` zapisuje `<name>-preview.png`: ciało + warstwa, potem to samo z każdą brodą z `finished/` na wierzchu.
- Bez `-cover` lub z `-cover hands`, bez `-gray` (hełmy, rękawice, narzędzia) dziury łatane są pikselem z obrazu Codexa: zamknięte do 60 px i wcięcia (≥5 z 8 sąsiadów w warstwie), ale tylko tam, gdzie obraz różni się od bazy o więcej niż 25. Materiał w kolorze skóry (wełna, skóra) wypada z porównania, a nietknięta twarz w otworze kaptura zostaje poza warstwą. Skrypt wypisuje `latanie dziur z obrazu zrodlowego: +N px`.
- Parametry ścieżek (`-base`, `-bodyPath`, `-dir`) mają domyślne wartości pod ten układ folderów.
- Gdy obraz z Codexa ma inny rozmiar niż `gen-3e.png`, skrypt przeskaluje go do rozmiaru bazy (najbliższy sąsiad) i wypisze ostrzeżenie. Kadr musi być ten sam co w bazie.

### `build-sheet.ps1`

Bez parametrów. Bierze wszystkie PNG 96×96 z `finished/` i składa `dwarf-layers.png` oraz `dwarf-layers.json`:

- rząd = przedrostek nazwy pliku, w kolejności rysowania: `body`, `armor`, `beard`, `tool`, `hand` (nakładka pięści nad narzędziem), `gloves`, `helmet`; inne przedrostki idą na koniec alfabetycznie;
- w rzędzie pliki stoją alfabetycznie; w JSON-ie nazwa wariantu to reszta nazwy pliku (`beard-full.png` → `full`, `body.png` → `base`).
- hełmy dostają w JSON-ie `light: {x, y}`: środek źródła światła w pikselach komórki, liczony z obrazka (największa zwarta plama bardzo jasnych, ciepłych pikseli: soczewka, płomień, klejnot; rozsiane błyski złota czy kości jej nie przesuwają). Hełm bez takich pikseli przerywa budowanie. Światło nie musi więc leżeć w stałym punkcie.

Nowa warstwa = wrzuć plik z dobrym przedrostkiem do `finished/` i uruchom skrypt.

### `apply-cuts.ps1`

```
apply-cuts.ps1 -marked dwarf-layers-cuts.png [-apply]
```

Ręczne poprawki na całym spritesheecie naraz. Użytkownik bierze kopię `dwarf-layers.png` i maluje na niej ołówkiem 1 px: czerwony `210,21,37` albo gumka = wyciąć (piksel przezroczysty), zielony `55,210,21` = brakujący piksel (dostaje średnią z sąsiadów warstwy, od brzegu do środka). Skrypt porównuje z `dwarf-layers.png`, komórki rozpoznaje z `dwarf-layers.json`. Inne zmienione kolory pomija i liczy jako „inne zmiany”.

- Bez `-apply` zapisuje kopie `body-guide/<warstwa>-cut.png` do podglądu, z `-apply` nadpisuje pliki w `finished/`. Potem `build-sheet.ps1`.
- Arkusz z oznaczeniami musi pochodzić z aktualnego `dwarf-layers.png` (ten sam układ komórek).

### `recolor-skin.ps1`

```
recolor-skin.ps1 [-source finished/body-<twarz>.png] [-tones tan,brown,dark]
```

Kolor skóry bez Codexa: geometria i cieniowanie zostają co do piksela. Zapisuje `body-guide/<ciało>-<odcień>.png` i `<ciało>-skins-preview.png` (wiersz = odcień; kolumny: samo ciało, ciemna broda, jasna broda, miner + ruda krótka + hełm, intern + siwe warkocze; 5× i 1:1).

- Skóra = ciepły odcień (z czerwienią nosa i policzków) nasycony albo bardzo jasny (highlight). Białka i tęczówki w innym kolorze zostają, skrypt wypisuje, ile takich pikseli zostało.
- Odcień: przesunięcie barwy, mnożnik nasycenia i nowy zakres jasności (`low`–`high`); obrys (piksele z kanałami ≤ 60) ciemnieje razem ze skórą (`outline`), żeby odcinał się od cieni. Odcienie w tablicy `$palette` na górze skryptu.
- Działa na każdym `body*.png`, więc twarze i kolory skóry łączą się dowolnie. Wybrany wynik → `finished/body-<twarz>-<odcień>.png`.

### `preview-colors.ps1`

```
preview-colors.ps1 [-filter "beard-*.png"]
```

Pokazuje każdą warstwę z `finished/` na ciele w 2 losowych kolorach (mnożenie). Zapisuje `colors-preview.png` w głównym folderze.

### `fit-body.ps1` (historyczny)

Tak powstało ciało: wynik Codexa przeskalowany do 96×96 i docięty do kolorowej maski z dawnego `maker.png` (komórka 2 rzędu 1). Maska jest skasowana, więc bez nowej maski skrypt nie zadziała. Zostaje jako wzór, gdyby trzeba było zrobić nowe ciało.
