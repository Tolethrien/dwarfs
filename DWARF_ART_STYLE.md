# Krasnoludy — zaakceptowany styl i budowa

Użytkownik zaakceptował ten kierunek 2026-10-17 jako „IDEALNE”. Kolejne krasnoludy rozwijamy w tym stylu.

## Wzorzec wizualny

- Aktualny nadrzędny wzorzec pojedynczego krasnoluda (2026-10-18): [v2.png](output/dwarf-original-96/v2.png). Użytkownik wskazał ten podgląd jako docelowy wygląd dla dalszej pracy warstwowej.
- [v2-body-96.png](output/dwarf-original-96/v2-body-96.png) jest kandydatem na bazę, nie zatwierdzonym ciałem. Prawa ręka krasnoluda (po lewej stronie obrazu) jest zbyt duża względem podglądu; pozostałe kontury również wymagają dopasowania. Nie dopasowywać wzorca do błędnej bazy.
- Warstwy przygotowywać na wspólnym płótnie 96×96, zachowując pozycję, pozę i proporcje wzorca. Nie centrować ani skalować każdej części osobno. Gotowość zestawu oceniać po rzeczywistym złożeniu PNG, porównanym z v2.png.
- Zaakceptowany wygląd: [obie postacie](output/imagegen/dwarfs-layered-v2/dwarfs-preview.png), [arkusz](output/imagegen/dwarfs-layered-v2/dwarfs-spritesheet.png).
- Główna zasada: krasnolud jest KULKĄ. Zwarta, niemal okrągła sylwetka, szerokość zbliżona do wysokości, wielki pękaty brzuch, głowa schowana w bryle, krótkie ręce przy bokach, bez nóg i wyciągniętej szyi.
- Ręcznie rysowana, nieregularna ciemna kreska; szorstka, ziarnista, malarska faktura; stonowane ziemiste kolory; czytelność małego sprite'a.
- Zachować charakter starych postaci z src/sandbox/assets/chars.png. Pierwsza gładka, wydłużona wersja została odrzucona. Nie wracać do jej stylu.
- Obraz krasnoludy-warstwy.png służy jako inspiracja podziału elementów, a nie jako nadrzędny wzorzec stylu czy proporcji.

## Aktualny stan (2026-10-19)

- Zaakceptowane ciało bazowe: `output/dwarf-original-96/finished/body.png` (96×96). Wszystkie warstwy w `finished/` leżą na nim na wspólnym płótnie; spritesheet `dwarf-layers.png` + `dwarf-layers.json`.
- Kolejność rysowania: ciało → strój → zarost → narzędzie → nakładka dłoni → rękawice → hełm.
- Nowe warstwy robimy edycją `body-guide/gen-3e.png` w Codexie i wycinamy skryptem; opis w `output/dwarf-original-96/scripts/README.md`. Część plików wymienionych niżej (v2, imagegen) została skasowana.

## Warstwy — aktualne wymagania użytkownika

1. **Skóra**: głowa oraz CAŁE ręce od ramion przez przedramiona aż po dłonie. Ręce są częścią skóry.
2. **Zarost**: brwi, wąsy, broda; bez fragmentów skóry. W odcieniach szarości, barwiony w grze (multiply).
3. **Strój**: ubranie/pancerz tułowia. Może mieć rękawy (krótkie albo długie, do nadgarstka), nałożone na ręce ze skóry. Same ręce i dłonie zostają w warstwie skóry, strój ich nie rysuje. Poprawka do zaakceptowanego arkusza v2: przenieść kompletne ręce na skórę.
4. **Rękawice**: osobne nakładki na dłonie, mankiet najdalej do łokcia (najlepiej do połowy przedramienia). Bliższa pięść zostaje zamknięta (na narzędzie).
5. **Hełm**: osobna nakładka na głowę, zawsze z lampką górniczą; daszek nad łukiem brwiowym (brwi są w zaroście, pod hełmem).

Elementy na przezroczystym tle, wspólny układ współrzędnych i skala. Warianty mają nadawać się do mieszania. Wygenerowany pogląd nie potwierdza jeszcze poprawnego składania warstw — przed integracją trzeba sprawdzić ich faktyczne nakładanie.

Pierwsze dwa zestawy: rudy zarost i brązowa skóra wyposażenia oraz ciemny zarost i szare żelazo. Każdą poprawkę robić na podstawie zaakceptowanego obrazu, zachowując kulistą sylwetkę i fakturę.
