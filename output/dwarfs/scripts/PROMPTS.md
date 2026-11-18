# Prompty dla Codexa (sprawdzone)

Każda wiadomość dla Codexa ma ten sam szkielet. Zmienia się tylko blok promptu, nazwy plików i tryb wycinania.

````
WAŻNE: nie nadpisuj ani nie edytuj w miejscu niczego w output/dwarf-original-96/finished/ ani gen-3e.png, reference-768.png, body-mask.png. Wyniki tylko pod nowymi nazwami.

Zrób <co> przez EDYCJĘ (edit/inpaint) imagegenem, nie generuj od nowa. Każdy wariant osobno, zawsze edytując czyste ciało gen-3e.png. Po 2 podejścia.
Załączniki: 1) output/dwarf-original-96/body-guide/gen-3e.png (obraz do edycji), 2) output/dwarf-original-96/body-guide/reference-768.png (wzór stylu).
Prompt (wyślij dosłownie):
```
<blok promptu z tego pliku>
```
Zapisz jako output/dwarf-original-96/body-guide/gen-<warstwa>-<nazwa>-<n>.png i dla każdego uruchom:
powershell -ExecutionPolicy Bypass -File output/dwarf-original-96/scripts/extract-layer.ps1 -source <plik> -name <warstwa>-<nazwa>-<n> <tryb z README>
Nie poprawiaj wyników ręcznie. Pokaż mi wszystkie *-tints.png / *-preview.png.
````

Reguły, które muszą zostać w każdym prompcie:
- „EDIT the first image … Change NOTHING else” i „Keep EVERYTHING ELSE pixel-identical … image size and framing”.
- Element nie rzuca cienia na skórę.
- Znak rozpoznawczy stroju jest na BRZUCHU (broda zakrywa pierś).
- Zarost w neutralnej szarości, bez czystej bieli. Stroje, rękawice i hełmy w kolorze.
- Bez ognia, dymu, iskier, poświaty (wycięłyby się jako śmieci).

---

## Zarost

Wzór (pełna broda). Przy innych kształtach podmień tylko listę „Facial hair to add”.

```
EDIT the first image: add facial hair to this bald, clean-shaven dwarf. Change NOTHING else.

Facial hair to add, shaped and placed like the beard in the second image:
- Bushy eyebrows on the brow ridge above both eyes. Heavy and low, but the eyes must stay visible below them.
- A big drooping mustache under the nose, covering the upper lip.
- A full, thick beard covering the cheeks, jaw and chin and hanging onto the chest, as in the second image. The mouth may stay partly visible between mustache and beard, as in the second image.
- Sideburns connecting the beard up to the hair line in front of the ear. They must end naturally in a soft tapered tuft; do NOT cut them off with a flat straight edge. The ear stays visible.

COLOR: paint ALL facial hair in neutral steel GREY (no red, no brown, no warm tint). Full value range from dark grey shadows to light grey highlights, but NO pure white pixels. The grey must clearly contrast with the skin everywhere.

STYLE: exactly the art style of the second image's beard. Hand-drawn chunky pixel art, irregular dark outline around the hair masses, rough grainy painterly strands, clumpy locks, same pixel size and same grain as the rest of the first image.

Do NOT paint shadows of the hair onto the skin. Keep EVERYTHING ELSE pixel-identical: skin, eyes, nose, ear, skull, arms, hands, belly, outline, white background, image size and framing. Overlaying the result on the first image must match exactly everywhere except where hair was added. No helmet, no hat, no clothes, no armor.
```

Inne kształty (podmiana listy):
- **krótka**: `A short, neat mustache under the nose.` + `A SHORT, close-cropped full beard that follows the jaw and chin closely … does NOT hang down onto the chest. The jaw shape must stay readable through it. The mouth and lower lip stay visible.` + krótkie bokobrody.
- **warkocze**: `A full beard … that splits below the chin into TWO thick braided plaits hanging down onto the belly, side by side, clearly readable as braids (chunky woven segments). Each braid ends in a short loose tuft below a simple tie. The tie is painted as a twisted band of the same hair, NOT metal, NOT beads, NOT leather.` + `Braids stay inside the body's outer silhouette.`

---

## Strój / pancerz (`-cover torso`)

Wzór (Miner). Dla innych klas podmień opis w „Outfit”.

```
EDIT the first image: dress this bald, beardless dwarf in a MINER'S work outfit. Change NOTHING else.

Outfit:
- A thick, worn brown leather work vest over a coarse dark shirt, covering the whole torso and belly: stitched leather panels, scuffs and mine dust, like the outfit in the second image.
- The shirt has SHORT rolled-up sleeves covering both upper arms down to just above the elbow. Forearms and hands stay bare skin.
- A wide dark leather belt around the belly with a big iron buckle, and a small hammer and a chisel hanging in belt loops. The belt and tools are the main identifying detail and must sit on the BELLY, below the chin, clearly visible.
- The collar ends at the neck line under the chin.

STRICT RULES:
- Sleeves follow the existing arm shapes exactly: do NOT move, resize or repose the arms. No gloves; hands stay bare skin, exactly as they are.
- The near forearm and fist (lower left) stay IN FRONT of the vest, untouched. The vest goes behind them.
- The outfit stays inside the body's existing outer outline; it may follow the outline but must not make the body wider.
- Do NOT touch the head: face, chin, ear, skull stay exactly as they are. No beard, no helmet, no hat.
- Do NOT paint shadows of the outfit onto the skin.

STYLE: exactly the art style of the second image's outfit. Hand-drawn chunky pixel art, irregular dark outline, rough grainy painterly texture, muted earthy colors, same pixel size and same grain as the rest of the first image.

Keep EVERYTHING ELSE pixel-identical: head, hands, outline, white background, image size and framing. Overlaying the result on the first image must match exactly everywhere except where the outfit was added.
```

Gotowe opisy „Outfit” innych klas:
- **Demolka**: `A thick padded protective jacket in charcoal-grey heavy canvas, soot-blackened and scorched, with burnt frayed edges` + `LONG thick padded sleeves … down to the wrists, with scorched cuffs` + `A bandolier strap running diagonally across the BELLY holding a row of red dynamite sticks, plus a coiled fuse cord hanging from the belt`; w STRICT RULES: `The near arm and fist (lower left) stay IN FRONT of the jacket body; the near sleeve is painted on that arm in place.` + `No fire, no smoke, no sparks.`
- **Intern**: `An oversized, faded off-white / beige linen shirt, a hand-me-down clearly too big for him … with a few mismatched patches and crooked stitches` + `Long baggy sleeves … rolled up unevenly to the middle of the forearm` + `A simple rope tied around the belly instead of a belt, with a small BLANK paper name tag pinned on the belly (no text, no letters).`
- **Wiertacz**: `A heavy chest piece of dark riveted iron plates over a dark oil-stained leather jerkin … brass trim along the plate edges and oil smudges` + `SHORT sleeves of thick dark leather with a riveted iron band at the hem` + `On the BELLY: a brass pressure gauge with a round dial and short brass pipes running into the plates` (manometr nisko, żeby broda go nie zasłaniała). `No steam, no smoke, no sparks.`
- Pomysły na resztę: Skaut (leśna zieleń, krótki kubrak, tuba na mapy i luneta przy pasie), Tragarz (khaki, uprząż i sakwy na brzuchu, zwój liny), Bojownik (kirys z nitami, granat + złoto, tarcza-płyta z runą na brzuchu).

---

## Rękawice (`-cover hands`)

```
EDIT the first image: put a pair of WORK GLOVES on this dwarf's hands. Change NOTHING else.

Gloves:
- Thick, worn brown leather work gloves on BOTH hands, like the gloves in the second image, with a wide flared cuff.
- The cuff reaches the MIDDLE of the forearm. It never goes past the elbow. The rest of the forearm and the upper arm stay bare skin.
- The near hand (lower left) stays a CLOSED FIST in exactly the same place, size and pose. The glove follows the fist's shape. The far hand (right side) is gloved in the same place and size.

STRICT RULES:
- Only the gloves are added. Do NOT touch the head, face, upper arms, body or belly.
- Gloves follow the existing hand and forearm shapes exactly: do NOT move, resize or repose the arms or hands. At most a slightly thicker outline than the bare hand.
- Do NOT paint shadows of the gloves onto the skin or body. No clothes, no beard, no helmet, nothing held in the hands.

STYLE: exactly the art style of the second image's gloves. Hand-drawn chunky pixel art, irregular dark outline, rough grainy painterly texture, muted earthy colors, same pixel size and same grain as the rest of the first image.

Keep EVERYTHING ELSE pixel-identical: head, body, upper arms, outline, white background, image size and framing.
```

Wariant **żelazny**: `Heavy dark iron plate gauntlets on BOTH hands: segmented riveted plates over the knuckles and fingers, worn brass rivets, over a dark leather glove.` + `The flared iron cuff reaches the MIDDLE of the forearm…`; kolory `muted colors (dark iron, worn brass)`.

---

## Hełm (bez trybu)

```
EDIT the first image: put a MINER'S HELMET on this bald dwarf's head. Change NOTHING else.

Helmet:
- A rounded hardened brown leather miner's helmet with a dark iron band around it, worn and scuffed, like the helmet in the second image.
- A brass miner's lamp mounted on the front of the helmet with a round, brightly lit pale-yellow lens. The lamp is the key detail and must be clearly visible.
- The helmet sits snugly on the skull. The front brim sits HIGH on the forehead, clearly ABOVE the brow ridge: the brow ridge, eyes, nose and ear stay fully visible.

STRICT RULES:
- Only the helmet is added. Do NOT touch the face, eyes, brow ridge, nose, ear, arms, hands or body.
- The helmet may rise slightly above the top of the head but must not get much wider than the head.
- No light beam, no glow, no rays, no sparks around the lamp, only the lit lens itself.
- Do NOT paint shadows of the helmet onto the skin. No beard, no clothes.

STYLE: exactly the art style of the second image's helmet. Hand-drawn chunky pixel art, irregular dark outline, rough grainy painterly texture, muted earthy colors, same pixel size and same grain as the rest of the first image.

Keep EVERYTHING ELSE pixel-identical: face, body, outline, white background, image size and framing.
```

Wariant **żelazny**: `A sturdy dark iron helmet made of riveted plates with a raised ridge over the top and a thick rim, dented and worn.` + `A large brass miner's lamp…`; kolory `muted colors (dark iron, worn brass)`. Lampka zawsze obowiązkowa.
