param(
  [string]$dir,
  [int]$size = 96
)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class RailCut {
  // białe tło połączone z krawędzią obrazka -> przezroczyste; jasna stal w środku szyny zostaje, bo otacza ją ciemny kontur
  public static Bitmap Cutout(string path) {
    Bitmap source = new Bitmap(path);
    Bitmap bmp = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(bmp)) g.DrawImage(source, 0, 0, source.Width, source.Height);
    source.Dispose();
    int width = bmp.Width, height = bmp.Height;
    BitmapData data = bmp.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int[] px = new int[width * height];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    bool[] seen = new bool[px.Length];
    Queue<int> queue = new Queue<int>();
    for (int x = 0; x < width; x++) { queue.Enqueue(x); queue.Enqueue((height - 1) * width + x); }
    for (int y = 0; y < height; y++) { queue.Enqueue(y * width); queue.Enqueue(y * width + width - 1); }
    while (queue.Count > 0) {
      int index = queue.Dequeue();
      if (seen[index]) continue;
      seen[index] = true;
      int c = px[index];
      int r = (c >> 16) & 255, gr = (c >> 8) & 255, b = c & 255;
      int max = Math.Max(r, Math.Max(gr, b)), min = Math.Min(r, Math.Min(gr, b));
      if (max < 200 || max - min > 40) continue;
      px[index] = 0;
      int x0 = index % width, y0 = index / width;
      if (x0 > 0) queue.Enqueue(index - 1);
      if (x0 < width - 1) queue.Enqueue(index + 1);
      if (y0 > 0) queue.Enqueue(index - width);
      if (y0 < height - 1) queue.Enqueue(index + width);
    }
    Marshal.Copy(px, 0, data.Scan0, px.Length);
    bmp.UnlockBits(data);
    return bmp;
  }

  // otwory wypełnione czystą zielenią (razem z zielonkawą obwódką) i zamknięte białe szpary (np. pod poręczą) -> przezroczyste
  public static void KeyHoles(Bitmap bmp) {
    int width = bmp.Width, height = bmp.Height;
    BitmapData data = bmp.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int[] px = new int[width * height];
    Marshal.Copy(data.Scan0, px, 0, px.Length);
    for (int i = 0; i < px.Length; i++) {
      int c = px[i];
      int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
      if (g - Math.Max(r, b) > 40) px[i] = 0;
    }
    bool[] seen = new bool[px.Length];
    for (int start = 0; start < px.Length; start++) {
      if (seen[start] || !IsWhite(px[start])) continue;
      List<int> island = new List<int>();
      Queue<int> queue = new Queue<int>();
      queue.Enqueue(start); seen[start] = true;
      while (queue.Count > 0) {
        int index = queue.Dequeue();
        island.Add(index);
        int x = index % width, y = index / width;
        foreach (int next in new int[] { x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1 }) {
          if (next < 0 || seen[next] || !IsWhite(px[next])) continue;
          seen[next] = true; queue.Enqueue(next);
        }
      }
      // drobne jasne odblaski zostają, większe białe płaty to tło
      if (island.Count > 400) foreach (int index in island) px[index] = 0;
    }
    Marshal.Copy(px, 0, data.Scan0, px.Length);
    bmp.UnlockBits(data);
  }

  static bool IsWhite(int c) {
    if (((c >> 24) & 255) == 0) return false;
    int r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    return Math.Min(r, Math.Min(g, b)) > 215 && Math.Max(r, Math.Max(g, b)) - Math.Min(r, Math.Min(g, b)) < 30;
  }

  // prostokąty otworów: spójne obszary czystej zieleni większe niż minArea, w kolejności od lewej
  public static List<Rectangle> GreenHoles(Bitmap bmp, int minArea) {
    int width = bmp.Width, height = bmp.Height;
    bool[] seen = new bool[width * height];
    List<Rectangle> holes = new List<Rectangle>();
    for (int y = 0; y < height; y += 4) {
      for (int x = 0; x < width; x += 4) {
        Color c = bmp.GetPixel(x, y);
        if (seen[y * width + x] || !(c.G > 200 && c.R < 80 && c.B < 80)) continue;
        int x0 = x, x1 = x, y0 = y, y1 = y, area = 0;
        Queue<int> queue = new Queue<int>();
        queue.Enqueue(y * width + x); seen[y * width + x] = true;
        while (queue.Count > 0) {
          int index = queue.Dequeue(); area++;
          int px = index % width, py = index / width;
          x0 = Math.Min(x0, px); x1 = Math.Max(x1, px); y0 = Math.Min(y0, py); y1 = Math.Max(y1, py);
          foreach (int next in new int[] { px > 0 ? index - 1 : -1, px < width - 1 ? index + 1 : -1, py > 0 ? index - width : -1, py < height - 1 ? index + width : -1 }) {
            if (next < 0 || seen[next]) continue;
            Color n = bmp.GetPixel(next % width, next / width);
            if (!(n.G > 200 && n.R < 80 && n.B < 80)) continue;
            seen[next] = true; queue.Enqueue(next);
          }
        }
        if (area > minArea) holes.Add(new Rectangle(x0, y0, x1 - x0 + 1, y1 - y0 + 1));
      }
    }
    holes.Sort((a, b) => a.X.CompareTo(b.X));
    return holes;
  }

  // dolne blend wierszy przechodzi w lustro górnych, więc dół segmentu płynnie łączy się z górą następnego
  // (słupy są pionowo jednorodne, lustro na kilku wierszach nie razi)
  public static void MirrorSeamV(Bitmap bmp, int blend) {
    int height = bmp.Height;
    for (int k = 0; k < blend; k++) {
      double t = (double)(k + 1) / blend;
      for (int x = 0; x < bmp.Width; x++) {
        Color own = bmp.GetPixel(x, height - blend + k);
        Color top = bmp.GetPixel(x, blend - 1 - k);
        bmp.SetPixel(x, height - blend + k, Color.FromArgb(
          (int)(own.A + (top.A - own.A) * t), (int)(own.R + (top.R - own.R) * t),
          (int)(own.G + (top.G - own.G) * t), (int)(own.B + (top.B - own.B) * t)));
      }
    }
  }

  // pasek długości length od x0; pierwsze blend kolumn przenika z tym, co leży tuż za paskiem,
  // więc koniec paska przechodzi w jego początek bez skoku (length = wielokrotność odstępu nitów)
  public static Bitmap SeamlessStrip(Bitmap src, int x0, int top, int height, int length, int blend) {
    Bitmap strip = new Bitmap(length, height, PixelFormat.Format32bppArgb);
    for (int y = 0; y < height; y++) {
      for (int x = 0; x < length; x++) {
        Color own = src.GetPixel(x0 + x, top + y);
        if (x >= blend) { strip.SetPixel(x, y, own); continue; }
        Color next = src.GetPixel(x0 + x + length, top + y);
        double t = (double)x / blend;
        strip.SetPixel(x, y, Color.FromArgb(
          (int)(next.A + (own.A - next.A) * t), (int)(next.R + (own.R - next.R) * t),
          (int)(next.G + (own.G - next.G) * t), (int)(next.B + (own.B - next.B) * t)));
      }
    }
    return strip;
  }
}
'@

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if(-not $dir){ $dir = Join-Path $scriptDir 'final' }
# źródła od Codexa w sources/, podglądy do previews/
$sourceDir = Join-Path $scriptDir 'sources'
$previewDir = Join-Path $scriptDir 'previews'
New-Item -ItemType Directory -Force $previewDir | Out-Null
$tile = 1024
# zmierzone w źródłach Codexa: profil szyny w rail-straight i ramki płyt łączeniowych
$SOURCE = @{
  rail = @{ file = 'rail-heavy-straight.png'; top = 402; bottom = 619; rivetRow = 435 }
  plates = @{
    corner = @{ file = 'rail-heavy-corner.png'; box = @(403, 331, 675, 613) }
    tee = @{ file = 'rail-heavy-tee.png'; box = @(384, 364, 640, 612) }
    cross = @{ file = 'rail-heavy-cross.png'; box = @(376, 350, 648, 648) }
  }
  # ze złączy belek bierzemy same żelazne okucia (belki Codex narysował w innych miejscach i grubościach):
  # prostokąty okucia, anchor = punkt źródła dopasowany do target w naszym kaflu (belka 276..746), scale = nasza belka / ich belka (T i krzyż w skali 1, inaczej okucie wychodzi za kafel)
  beamJoints = @{
    corner = @{ file = 'rail-beam-corner.png'; rects = @(@(193, 275, 575, 362), @(515, 220, 697, 838)); anchor = @(697, 215); target = @(746, 276); scale = 1.3 }
    tee = @{ file = 'rail-beam-tee.png'; rects = @(@(93, 403, 932, 477), @(417, 375, 607, 522), @(470, 518, 555, 852)); anchor = @(512, 437); target = @(512, 511); scale = 1 }
    cross = @{ file = 'rail-beam-cross.png'; rects = @(@(190, 460, 835, 550), @(394, 400, 630, 617), @(460, 206, 562, 807)); anchor = @(512, 492); target = @(512, 511); scale = 1 }
  }
}

function newTile { [System.Drawing.Bitmap]::new($tile, $tile, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb) }

# prosty: wycinek o długości pełnej liczby odstępów między nitami, rozciągnięty na kafel, żeby nity szły równo przez szwy
$straightSource = [RailCut]::Cutout((Join-Path $sourceDir $SOURCE.rail.file))
$rivets = @(); $inRivet = $false; $start = 0
for($x=0;$x -lt $tile;$x++){
  $c = $straightSource.GetPixel($x, $SOURCE.rail.rivetRow)
  $copper = $c.A -gt 0 -and $c.R -gt 120 -and $c.R - $c.B -gt 50
  if($copper -and -not $inRivet){ $inRivet = $true; $start = $x }
  if(-not $copper -and $inRivet){ $inRivet = $false; $rivets += ($start + $x - 1) / 2 }
}
$spacing = ($rivets[-1] - $rivets[0]) / ($rivets.Count - 1)
$from = [Math]::Max(0, $rivets[0] - $spacing / 2)
$period = $spacing * ($rivets.Count - 1)
Write-Output "nity: $($rivets.Count), odstęp $([Math]::Round($spacing,1)) px, wycinek $([Math]::Round($from)) + $([Math]::Round($period))"

# pas [top, bottom] ze źródła, okresowy wycinek z przenikaniem końców, rozciągnięty na kafel i wyśrodkowany w pionie
function straightTile($source, $top, $bottom, $from, $length, $blend){
  $bmp = newTile
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  $height = $bottom - $top + 1
  $strip = [RailCut]::SeamlessStrip($source, [int]$from, $top, $height, [int]$length, [int]$blend)
  # pasek jest okresowy w poziomie: przy skalowaniu zawijany, a nie wygaszany za brzegiem
  $wrap = [System.Drawing.Imaging.ImageAttributes]::new(); $wrap.SetWrapMode('Tile')
  $g.DrawImage($strip, [System.Drawing.Rectangle]::new(0, [int](($tile - $height) / 2), $tile, $height), 0, 0, $strip.Width, $strip.Height, 'Pixel', $wrap)
  $g.Dispose(); $strip.Dispose()
  $bmp
}
function turned($bmp){ $copy = $bmp.Clone(); $copy.RotateFlip('Rotate90FlipNone'); $copy }

$straight = straightTile $straightSource $SOURCE.rail.top $SOURCE.rail.bottom $from $period $spacing
$vertical = turned $straight
$half = $tile / 2
# ramię sięga za środek o overhang; złącze na środku przykrywa łączenie
function arms($overhang){
  @{
    left = [System.Drawing.Rectangle]::new(0, 0, $half + $overhang, $tile)
    bottom = [System.Drawing.Rectangle]::new(0, $half - $overhang, $tile, $half + $overhang)
    full = [System.Drawing.Rectangle]::new(0, 0, $tile, $tile)
  }
}

# plate = $null: złącza jeszcze nie ma, zostają same ramiona
function compose($parts, $plate){
  $bmp = newTile
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  foreach($part in $parts){ $g.DrawImage($part.image, $part.rect, $part.rect, 'Pixel') }
  if($plate -and (Test-Path (Join-Path $sourceDir $plate.file))){
    $source = [RailCut]::Cutout((Join-Path $sourceDir $plate.file))
    if($plate.rects){
      # okucie złożone z prostokątów źródła: punkt anchor źródła trafia w target kafla, całość w skali scale
      $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
      foreach($rect in $plate.rects){
        $x = $plate.target[0] + ($rect[0] - $plate.anchor[0]) * $plate.scale
        $y = $plate.target[1] + ($rect[1] - $plate.anchor[1]) * $plate.scale
        $width = $rect[2] - $rect[0]; $height = $rect[3] - $rect[1]
        $g.DrawImage($source, [System.Drawing.RectangleF]::new($x, $y, $width * $plate.scale, $height * $plate.scale), [System.Drawing.RectangleF]::new($rect[0], $rect[1], $width, $height), 'Pixel')
      }
    } else {
      $box = $plate.box
      $width = $box[2] - $box[0] + 1; $height = $box[3] - $box[1] + 1
      $g.DrawImage($source, [System.Drawing.Rectangle]::new([int]($half - $width / 2), [int]($half - $height / 2), $width, $height), [System.Drawing.Rectangle]::new($box[0], $box[1], $width, $height), 'Pixel')
    }
    $source.Dispose()
  }
  $g.Dispose()
  $bmp
}

$railArm = arms 80
$tiles = [ordered]@{
  'rail-straight' = $straight
  'rail-corner' = compose @(@{ image = $straight; rect = $railArm.left }, @{ image = $vertical; rect = $railArm.bottom }) $SOURCE.plates.corner
  'rail-tee' = compose @(@{ image = $straight; rect = $railArm.full }, @{ image = $vertical; rect = $railArm.bottom }) $SOURCE.plates.tee
  'rail-cross' = compose @(@{ image = $straight; rect = $railArm.full }, @{ image = $vertical; rect = $railArm.full }) $SOURCE.plates.cross
}

# belka nośna pod szyną: wycinek 896 px, przenikanie na 128 px; zwykła i z mocowaniem tnięte identycznie, więc ich końce pasują
$SOURCE.beam = @{ top = 258; bottom = 742; from = 0; length = 896; blend = 128 }
$beamSource = [RailCut]::Cutout((Join-Path $sourceDir 'rail-beam.png'))
$mountSource = [RailCut]::Cutout((Join-Path $sourceDir 'rail-beam-mount.png'))
$beam = straightTile $beamSource $SOURCE.beam.top $SOURCE.beam.bottom $SOURCE.beam.from $SOURCE.beam.length $SOURCE.beam.blend
$beamVertical = turned $beam
# ramię kończy się równo z zewnętrzną krawędzią belki prostopadłej (746 - 512)
$beamArm = arms 234
$tiles['beam-straight'] = $beam
$tiles['beam-mount'] = straightTile $mountSource $SOURCE.beam.top $SOURCE.beam.bottom $SOURCE.beam.from $SOURCE.beam.length $SOURCE.beam.blend
$tiles['beam-corner'] = compose @(@{ image = $beamVertical; rect = $beamArm.bottom }, @{ image = $beam; rect = $beamArm.left }) $SOURCE.beamJoints.corner
$tiles['beam-tee'] = compose @(@{ image = $beamVertical; rect = $beamArm.bottom }, @{ image = $beam; rect = $beamArm.full }) $SOURCE.beamJoints.tee
$tiles['beam-cross'] = compose @(@{ image = $beamVertical; rect = $beamArm.full }, @{ image = $beam; rect = $beamArm.full }) $SOURCE.beamJoints.cross

New-Item -ItemType Directory -Force $dir | Out-Null
$small = @{}
foreach($name in $tiles.Keys){
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  # lustro za brzegiem: szyna przy krawędzi ciągnie się dalej, więc brzeg kafla nie robi się półprzezroczysty
  $mirror = [System.Drawing.Imaging.ImageAttributes]::new(); $mirror.SetWrapMode('TileFlipXY')
  $g.DrawImage($tiles[$name], [System.Drawing.Rectangle]::new(0, 0, $size, $size), 0, 0, $tile, $tile, 'Pixel', $mirror)
  $g.Dispose()
  $bmp.Save((Join-Path $dir "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $small[$name] = $bmp
}

# podgląd: pełny układ (łuki, T, skrzyżowanie) na tle kopalni, obok krasnolud w tej samej skali
$finished = Join-Path $scriptDir '..\dwarfs\finished'
$dwarf = [System.Drawing.Bitmap]::new($size, $size)
$g = [System.Drawing.Graphics]::FromImage($dwarf)
foreach($file in 'body.png','armor-miner.png','gloves-leather.png','helmet-leather.png'){ $g.DrawImage([System.Drawing.Bitmap]::new((Join-Path $finished $file)), 0, 0, $size, $size) }
$g.Dispose()

function rotated($name, $turns){
  $bmp = $small[$name].Clone()
  switch($turns){ 1 { $bmp.RotateFlip('Rotate90FlipNone') } 2 { $bmp.RotateFlip('Rotate180FlipNone') } 3 { $bmp.RotateFlip('Rotate270FlipNone') } }
  $bmp
}
# narożnik bazowo łączy lewo+dół, T bazowo lewo+prawo+dół; obrót o 90° zgodnie z zegarem
$layout = @(
  @( @('rail-corner',3), @('rail-straight',0), @('rail-tee',0), @('rail-straight',0), @('rail-corner',0) ),
  @( @('rail-tee',3), @('rail-straight',0), @('rail-cross',0), @('rail-straight',0), @('rail-tee',1) ),
  @( @('rail-corner',2), @('rail-straight',0), @('rail-tee',2), @('rail-straight',0), @('rail-corner',1) )
)
$columns = 7; $rows = 3
foreach($scale in 1,2){
  $preview = [System.Drawing.Bitmap]::new($columns*$size*$scale, $rows*$size*$scale)
  $g = [System.Drawing.Graphics]::FromImage($preview)
  $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
  $g.Clear([System.Drawing.Color]::FromArgb(255,92,74,58))
  # belka pod szyną tego samego kształtu; co drugi prosty odcinek z mocowaniem
  foreach($layer in 'beam','rail'){
    for($row=0;$row -lt $rows;$row++){ for($column=0;$column -lt 5;$column++){
      $cell = $layout[$row][$column]
      $name = $cell[0]
      if($layer -eq 'beam'){ $name = if($name -eq 'rail-straight' -and $column % 2 -eq 1){ 'beam-mount' } else { $name.Replace('rail-','beam-') } }
      $g.DrawImage((rotated $name $cell[1]), $column*$size*$scale, $row*$size*$scale, $size*$scale, $size*$scale)
    }}
  }
  $g.DrawImage($dwarf, 6*$size*$scale, 1*$size*$scale, $size*$scale, $size*$scale)
  $g.Dispose()
  $preview.Save((Join-Path $previewDir "rails-preview-x$scale.png"), [System.Drawing.Imaging.ImageFormat]::Png)
}


# spritesheet do gry: kafle 96, w json strony, z którymi kafel łączy się w orientacji bazowej
# (inne orientacje = obrót o 90° zgodnie z zegarem: lewo → góra → prawo → dół)
# rząd 0 szyna, rząd 1 belka (rysowana pod szyną)
$connects = @{
  straight = @('left','right')
  mount = @('left','right')
  corner = @('left','bottom')
  tee = @('left','right','bottom')
  cross = @('left','right','top','bottom')
}
$sheetRows = @(
  @('rail-straight','rail-corner','rail-tee','rail-cross'),
  @('beam-straight','beam-mount','beam-corner','beam-tee','beam-cross')
)
$sheetColumns = ($sheetRows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
$sheet = [System.Drawing.Bitmap]::new($sheetColumns*$size, $sheetRows.Count*$size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$frames = [ordered]@{}
for($row=0;$row -lt $sheetRows.Count;$row++){ for($column=0;$column -lt $sheetRows[$row].Count;$column++){
  $name = $sheetRows[$row][$column]
  $g.DrawImageUnscaled($small[$name], $column*$size, $row*$size)
  $frames[$name] = [ordered]@{ crop = [ordered]@{ x = $column*$size; y = $row*$size; width = $size; height = $size }; connects = $connects[$name.Split('-')[1]] }
}}
$g.Dispose()
$sheet.Save((Join-Path $dir 'monorail-spritesheet.png'), [System.Drawing.Imaging.ImageFormat]::Png)
[ordered]@{ image = 'monorail-spritesheet.png'; frameWidth = $size; frameHeight = $size; columns = $sheetColumns; rows = $sheetRows.Count; frames = $frames } |
  ConvertTo-Json -Depth 5 | Set-Content (Join-Path $dir 'monorail-spritesheet.json') -Encoding UTF8

# wagony: ta sama gęstość co kafle (96 px na kafel), szerokość w kaflach razem z odbojami.
# Warianty jednego wagonu na wspólnym płótnie; pivot = środek bryły pierwszego wariantu (tam przechodzi szyna).
# Gondola ma okna na wylot (zielone w źródle); seats = środki okien, kulki rysuje się pod gondolą,
# rider = rozmiar kulki (z pełnej tekstury, skalowanej płynnie) i przesunięcie w dół od środka okna
$VEHICLES = [ordered]@{
  cart = @{ tiles = 2; variants = [ordered]@{ empty = 'cart-wide-empty.png'; loaded = 'cart-wide-loaded.png' } }
  gondola = @{ tiles = 2.75; variants = [ordered]@{ base = 'gondola-v2.png' }; seats = $true; pivotOffsetY = 20; rider = [ordered]@{ size = 96; offsetY = 20 } }
}
function opaqueBounds($bmp){
  $x0 = $bmp.Width; $y0 = $bmp.Height; $x1 = 0; $y1 = 0
  for($y=0;$y -lt $bmp.Height;$y+=2){ for($x=0;$x -lt $bmp.Width;$x+=2){
    if($bmp.GetPixel($x,$y).A -gt 0){ $x0 = [Math]::Min($x0,$x); $x1 = [Math]::Max($x1,$x); $y0 = [Math]::Min($y0,$y); $y1 = [Math]::Max($y1,$y) }
  }}
  @{ x0 = $x0; y0 = $y0; x1 = $x1 + 1; y1 = $y1 + 1 }
}
$vehicleJson = [ordered]@{}
foreach($name in $VEHICLES.Keys){
  $spec = $VEHICLES[$name]
  $sources = [ordered]@{}
  $holes = $null
  foreach($variant in $spec.variants.Keys){
    $path = Join-Path $sourceDir $spec.variants[$variant]
    if($spec.seats -and -not $holes){ $raw = [System.Drawing.Bitmap]::new($path); $holes = [RailCut]::GreenHoles($raw, 5000); $raw.Dispose() }
    $bmp = [RailCut]::Cutout($path)
    [RailCut]::KeyHoles($bmp)
    $sources[$variant] = $bmp
  }
  $first = @($sources.Values)[0]
  $body = opaqueBounds $first
  $top = $body.y0; $bottom = $body.y1
  foreach($bmp in $sources.Values){ $bounds = opaqueBounds $bmp; $top = [Math]::Min($top, $bounds.y0); $bottom = [Math]::Max($bottom, $bounds.y1) }
  $scale = $spec.tiles * $size / ($body.x1 - $body.x0)
  $width = [int][Math]::Ceiling(($body.x1 - $body.x0) * $scale)
  $height = [int][Math]::Ceiling(($bottom - $top) * $scale)
  foreach($variant in $sources.Keys){
    $bmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
    $g.DrawImage($sources[$variant], [System.Drawing.RectangleF]::new(0, 0, $width, $height), [System.Drawing.RectangleF]::new($body.x0, $top, $width / $scale, $height / $scale), 'Pixel')
    $g.Dispose()
    $file = if($sources.Count -gt 1){ "$name-$variant.png" } else { "$name.png" }
    $bmp.Save((Join-Path $dir $file), [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $entry = [ordered]@{
    width = $width; height = $height
    pivot = [ordered]@{ x = [Math]::Round($width / 2, 1); y = [Math]::Round((($body.y0 + $body.y1) / 2 - $top) * $scale, 1) }
    variants = @($sources.Keys)
  }
  # pivotOffsetY: pivot niżej na sprite = wagon jedzie wyżej na torze poziomym (w pionie bez znaczenia)
  if($spec.pivotOffsetY){ $entry.pivot.y = [Math]::Round($entry.pivot.y + $spec.pivotOffsetY, 1) }
  # szyna nie może przechodzić za pustym oknem: pivot na środku pełnej blachy pod oknami
  if($spec.pivotBelowSeats){
    $windowsBottom = ($holes | ForEach-Object { $_.Y + $_.Height } | Measure-Object -Maximum).Maximum
    $entry.pivot.y = [Math]::Round((($windowsBottom + $body.y1) / 2 - $top) * $scale, 1)
  }
  if($holes){
    $entry.seats = @($holes | ForEach-Object { [ordered]@{
      x = [Math]::Round(($_.X + $_.Width / 2 - $body.x0) * $scale, 1); y = [Math]::Round(($_.Y + $_.Height / 2 - $top) * $scale, 1)
      width = [Math]::Round($_.Width * $scale, 1); height = [Math]::Round($_.Height * $scale, 1)
    } })
  }
  if($spec.rider){ $entry.rider = $spec.rider; $entry.rider.scale = [Math]::Round($spec.rider.size / $size, 4) }
  $vehicleJson[$name] = $entry
  Write-Output "$name : ${width}x$height, pivot $($entry.pivot.x),$($entry.pivot.y), okna: $(if($holes){ $holes.Count } else { 0 })"
}
$vehicleJson | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $dir 'vehicles.json') -Encoding UTF8


# ładunek: każdy przedmiot na płótnie 96 × 96 (pełna skala = krasnolud), wspólna skala źródeł 96/1024, więc zostają
# względne rozmiary z rysunku; przedmiot wyśrodkowany w poziomie i stoi dołem na krawędzi płótna
$CARGO = @('cargo-crate-a','cargo-crate-b','cargo-barrel-a','cargo-barrel-b')
foreach($name in $CARGO){
  $source = [RailCut]::Cutout((Join-Path $sourceDir "$name.png"))
  $bounds = opaqueBounds $source
  $cargoScale = $size / $source.Width
  $itemWidth = ($bounds.x1 - $bounds.x0) * $cargoScale; $itemHeight = ($bounds.y1 - $bounds.y0) * $cargoScale
  $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $g.DrawImage($source, [System.Drawing.RectangleF]::new(($size - $itemWidth) / 2, $size - $itemHeight, $itemWidth, $itemHeight), [System.Drawing.RectangleF]::new($bounds.x0, $bounds.y0, $bounds.x1 - $bounds.x0, $bounds.y1 - $bounds.y0), 'Pixel')
  $g.Dispose()
  $bmp.Save((Join-Path $dir "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $source.Dispose()
}
# stacja = jeden węzeł grafu toru: sprite 5 × 3 kafle wyśrodkowany na kaflu węzła, po 2 kafle toru z każdej strony
# (tor wpieczony w tył, gra nie rysuje tam swoich kafli). Tył = cały budynek, przód = maska Codexa bez zieleni
# (słupy, dach, przód peronu), wspólny dla obu wersji. Wersja szybowa: w tyle wycięty środek ściany, za stacją
# szyb i platforma. Kolejność w grze: (szyb, platforma) → tył → wagon → kulki i ładunek na peronie → przód.
# Peron dzielony na pół: lewa połowa kolejka kulek (nachodzą na siebie jak ikonki), prawa ładunek czekający na wagon
$STATION = @{
  back = 'station.png'; shaftBack = 'station-shaft.png'; front = 'station-front-mask.png'; tiles = @{ x = 5; y = 3 }
  queue = @{ count = 4; size = 76 }
  cargo = @{ count = 4; size = 76 }
}
$stationBack = [RailCut]::Cutout((Join-Path $sourceDir $STATION.back))
[RailCut]::KeyHoles($stationBack)
$stationShaftBack = [RailCut]::Cutout((Join-Path $sourceDir $STATION.shaftBack))
[RailCut]::KeyHoles($stationShaftBack)
$frontRaw = [System.Drawing.Bitmap]::new((Join-Path $sourceDir $STATION.front))
$interior = [RailCut]::GreenHoles($frontRaw, 20000)[0]
$frontRaw.Dispose()
$shaftRaw = [System.Drawing.Bitmap]::new((Join-Path $sourceDir $STATION.shaftBack))
$opening = [RailCut]::GreenHoles($shaftRaw, 20000)[0]
$shaftRaw.Dispose()
$stationFront = [RailCut]::Cutout((Join-Path $sourceDir $STATION.front))
[RailCut]::KeyHoles($stationFront)
# obie wersje w kadrze zwykłej, żeby szybowa leżała dokładnie na niej
$body = opaqueBounds $stationBack
# Codex dał ok. 1,57:1, wysokość dociągnięta do 3 kafli (ściśnięcie ~2%, niewidoczne)
$width = $STATION.tiles.x * $size; $height = $STATION.tiles.y * $size
$scaleX = $width / ($body.x1 - $body.x0); $scaleY = $height / ($body.y1 - $body.y0)
foreach($part in @(@('back', $stationBack), @('shaft-back', $stationShaftBack), @('front', $stationFront))){
  $bmp = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $g.DrawImage($part[1], [System.Drawing.RectangleF]::new(0, 0, $width, $height), [System.Drawing.RectangleF]::new($body.x0, $body.y0, $body.x1 - $body.x0, $body.y1 - $body.y0), 'Pixel')
  # tor wpieczony w tył: belka z mocowaniem przy słupach, szyna
  if($part[0] -ne 'front'){
    $railTop = [int]($height / 2 - $size / 2)
    for($index=0;$index -lt $STATION.tiles.x;$index++){
      $beamName = if($index -eq 0 -or $index -eq $STATION.tiles.x - 1){ 'beam-mount' } else { 'beam-straight' }
      $g.DrawImageUnscaled($small[$beamName], $index * $size, $railTop)
    }
    for($index=0;$index -lt $STATION.tiles.x;$index++){ $g.DrawImageUnscaled($small['rail-straight'], $index * $size, $railTop) }
  }
  $g.Dispose()
  $bmp.Save((Join-Path $dir "station-$($part[0]).png"), [System.Drawing.Imaging.ImageFormat]::Png)
}
$deck = ($interior.Y + $interior.Height - $body.y0) * $scaleY

# szyb: segment 3 × 1 kafel, powtarzany w pionie (szew dół→góra wygładzony lustrem 32 wierszy źródła)
$segment = [RailCut]::Cutout((Join-Path $sourceDir 'shaft-segment.png'))
[RailCut]::MirrorSeamV($segment, 32)
$shaftWidth = 3 * $size
$bmp = [System.Drawing.Bitmap]::new($shaftWidth, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
$tileWrap = [System.Drawing.Imaging.ImageAttributes]::new(); $tileWrap.SetWrapMode('Tile')
$g.DrawImage($segment, [System.Drawing.Rectangle]::new(0, 0, $shaftWidth, $size), 0, 0, $segment.Width, $segment.Height, 'Pixel', $tileWrap)
$g.Dispose()
$bmp.Save((Join-Path $dir 'shaft-segment.png'), [System.Drawing.Imaging.ImageFormat]::Png)
# tylna ściana szybu pod słupami, pełna (bez przezroczystości); Codex domknął szew sam: dół i góra kończą się
# ciemną szparą między deskami
$shaftBackSource = [System.Drawing.Bitmap]::new((Join-Path $sourceDir 'shaft-back.png'))
$bmp = [System.Drawing.Bitmap]::new($shaftWidth, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
$g.DrawImage($shaftBackSource, [System.Drawing.Rectangle]::new(0, 0, $shaftWidth, $size), 0, 0, $shaftBackSource.Width, $shaftBackSource.Height, 'Pixel', $tileWrap)
$g.Dispose()
$bmp.Save((Join-Path $dir 'shaft-back.png'), [System.Drawing.Imaging.ImageFormat]::Png)

# platforma: szerokość szybu bez połowy słupów (ślizgi wchodzą w słupy); pivot = środek górnej powierzchni pomostu
$platformSource = [RailCut]::Cutout((Join-Path $sourceDir 'lift-platform.png'))
[RailCut]::KeyHoles($platformSource)
$platformBounds = opaqueBounds $platformSource
$PLATFORM = @{ width = 268; deckTopInSource = 505 }
$platformScale = $PLATFORM.width / ($platformBounds.x1 - $platformBounds.x0)
$platformHeight = [int][Math]::Ceiling(($platformBounds.y1 - $platformBounds.y0) * $platformScale)
$bmp = [System.Drawing.Bitmap]::new($PLATFORM.width, $platformHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
$g.DrawImage($platformSource, [System.Drawing.RectangleF]::new(0, 0, $PLATFORM.width, $platformHeight), [System.Drawing.RectangleF]::new($platformBounds.x0, $platformBounds.y0, $platformBounds.x1 - $platformBounds.x0, $platformBounds.y1 - $platformBounds.y0), 'Pixel')
$g.Dispose()
$bmp.Save((Join-Path $dir 'lift-platform.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$platformDeck = ($PLATFORM.deckTopInSource - $platformBounds.y0) * $platformScale

$left = ($interior.X - $body.x0) * $scaleX
$halfSpan = $interior.Width * $scaleX / 2
# rzędy od lewej: kulki i ładunek nachodzą na siebie, w tej samej skali (płótno 76 z 96)
function row($from, $span, $count, $size, $overlap){
  $step = if($overlap){ ($span - $size) / ($count - 1) } else { $span / $count }
  $offset = if($overlap){ $size / 2 } else { $step / 2 }
  @(0..($count - 1) | ForEach-Object { [ordered]@{ x = [Math]::Round($from + $offset + $step * $_, 1); y = [Math]::Round($deck - $size / 2, 1) } })
}
$stationJson = [ordered]@{
  width = $width; height = $height
  tiles = [ordered]@{ x = $STATION.tiles.x; y = $STATION.tiles.y }
  pivot = [ordered]@{ x = $width / 2; y = $height / 2 }
  # scale = rozmiar względem pełnego krasnoluda (96 px tekstury)
  queue = [ordered]@{ size = $STATION.queue.size; scale = [Math]::Round($STATION.queue.size / $size, 4); spots = row ($left + 4) ($halfSpan - 8) $STATION.queue.count $STATION.queue.size $true }
  cargo = [ordered]@{ size = $STATION.cargo.size; scale = [Math]::Round($STATION.cargo.size / $size, 4); items = $CARGO; spots = row ($left + $halfSpan + 4) ($halfSpan - 8) $STATION.cargo.count $STATION.cargo.size $true }
  # wersja szybowa: station-shaft-back zamiast station-back. Szyb (kolumna shaft-segment, 3 kafle) wyśrodkowany nad
  # węzłem schodzi za stację; platforma stoi na dole, gdy jej pivot (góra pomostu) = deckY stacji
  shaft = [ordered]@{
    segment = [ordered]@{ width = $shaftWidth; height = $size }
    opening = [ordered]@{ x = [Math]::Round(($opening.X - $body.x0) * $scaleX, 1); y = [Math]::Round(($opening.Y - $body.y0) * $scaleY, 1); width = [Math]::Round($opening.Width * $scaleX, 1); height = [Math]::Round($opening.Height * $scaleY, 1) }
    deckY = [Math]::Round($deck, 1)
    platform = [ordered]@{ width = $PLATFORM.width; height = $platformHeight; pivot = [ordered]@{ x = $PLATFORM.width / 2; y = [Math]::Round($platformDeck, 1) } }
  }
}
$stationJson | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $dir 'station.json') -Encoding UTF8
Write-Output "station : ${width}x$height, peron y $([Math]::Round($deck,1)), otwor x $($stationJson.shaft.opening.x) szer $($stationJson.shaft.opening.width), platforma $($PLATFORM.width)x$platformHeight pivot y $([Math]::Round($platformDeck,1))"

# nadszybie: wieża na powierzchni nad szybem, 5 kafli szerokości, dół = poziom gruntu. Tył = cały budynek, przód = maska
# bez zieleni (wnętrze hali wejściowej za platformą). Kolejność w grze: tył → szyb (pod gruntem) → kulka → platforma → przód.
# pivot = środek szybu na poziomie gruntu; platforma startuje z pomostem równo z gruntem (jej pivot = pivot nadszybia)
$HEADFRAME = @{ back = 'headframe.png'; front = 'headframe-front-mask.png'; tiles = 5 }
$headBack = [RailCut]::Cutout((Join-Path $sourceDir $HEADFRAME.back))
[RailCut]::KeyHoles($headBack)
$headFront = [RailCut]::Cutout((Join-Path $sourceDir $HEADFRAME.front))
[RailCut]::KeyHoles($headFront)
$headRaw = [System.Drawing.Bitmap]::new((Join-Path $sourceDir $HEADFRAME.front))
$entrance = [RailCut]::GreenHoles($headRaw, 20000)[0]
$headRaw.Dispose()
$headBody = opaqueBounds $headBack
$headScale = $HEADFRAME.tiles * $size / ($headBody.x1 - $headBody.x0)
$headWidth = $HEADFRAME.tiles * $size
$headHeight = [int][Math]::Ceiling(($headBody.y1 - $headBody.y0) * $headScale)
foreach($part in @(@('back', $headBack), @('front', $headFront))){
  $bmp = [System.Drawing.Bitmap]::new($headWidth, $headHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'
  $g.DrawImage($part[1], [System.Drawing.RectangleF]::new(0, 0, $headWidth, $headHeight), [System.Drawing.RectangleF]::new($headBody.x0, $headBody.y0, $headBody.x1 - $headBody.x0, $headHeight / $headScale), 'Pixel')
  $g.Dispose()
  # tylna ściana hali kończy się w źródle nad gruntem: przedłużona w dół do gruntu powtórzeniem dolnych 8 wierszy,
  # żeby między halą a szybem nie było szpary
  if($part[0] -eq 'back'){
    $x0 = [int](($entrance.X - $headBody.x0) * $headScale) - 2; $x1 = [int](($entrance.X + $entrance.Width - $headBody.x0) * $headScale) + 2
    for($x=$x0;$x -le $x1;$x++){
      $last = -1
      for($y=$headHeight - 1;$y -gt $headHeight / 2;$y--){ if($bmp.GetPixel($x, $y).A -gt 200){ $last = $y; break } }
      if($last -lt 0 -or $last -ge $headHeight - 1){ continue }
      for($y=$last + 1;$y -lt $headHeight;$y++){ $bmp.SetPixel($x, $y, $bmp.GetPixel($x, $last - (($y - $last - 1) % 8))) }
    }
  }
  $bmp.Save((Join-Path $dir "headframe-$($part[0]).png"), [System.Drawing.Imaging.ImageFormat]::Png)
}
[ordered]@{
  width = $headWidth; height = $headHeight
  tiles = [ordered]@{ x = $HEADFRAME.tiles; y = [Math]::Round($headHeight / $size, 2) }
  pivot = [ordered]@{ x = $headWidth / 2; y = $headHeight }
  entrance = [ordered]@{ x = [Math]::Round(($entrance.X - $headBody.x0) * $headScale, 1); y = [Math]::Round(($entrance.Y - $headBody.y0) * $headScale, 1); width = [Math]::Round($entrance.Width * $headScale, 1); height = [Math]::Round($entrance.Height * $headScale, 1) }
} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $dir 'headframe.json') -Encoding UTF8
Write-Output "headframe : ${headWidth}x$headHeight, wejscie x $([Math]::Round(($entrance.X - $headBody.x0) * $headScale,1)) szer $([Math]::Round($entrance.Width * $headScale,1))"

# jeden wspólny spritesheet całego transportu: wszystkie pliki z final/ upakowane półkami (od najwyższych),
# 2 px odstępu przeciw przenikaniu przy filtrowaniu; json = ramki + dane z pozostałych jsonów
$PACK = @{ width = 1024; padding = 2; name = 'transport-spritesheet' }
$sprites = @(Get-ChildItem $dir -Filter '*.png' | Where-Object { $_.BaseName -ne $PACK.name -and $_.BaseName -ne 'monorail-spritesheet' } | ForEach-Object {
  $image = [System.Drawing.Bitmap]::new($_.FullName)
  [pscustomobject]@{ name = $_.BaseName; image = $image; width = $image.Width; height = $image.Height }
} | Sort-Object -Property @{ Expression = 'height'; Descending = $true }, name)
$x = 0; $y = 0; $shelf = 0
foreach($sprite in $sprites){
  if($x + $sprite.width -gt $PACK.width){ $x = 0; $y += $shelf + $PACK.padding; $shelf = 0 }
  $sprite | Add-Member x $x; $sprite | Add-Member y $y
  $x += $sprite.width + $PACK.padding
  $shelf = [Math]::Max($shelf, $sprite.height)
}
$sheetHeight = $y + $shelf
$packed = [System.Drawing.Bitmap]::new($PACK.width, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($packed)
$frames = [ordered]@{}
foreach($sprite in ($sprites | Sort-Object name)){
  $g.DrawImageUnscaled($sprite.image, $sprite.x, $sprite.y)
  $frames[$sprite.name] = [ordered]@{ x = $sprite.x; y = $sprite.y; width = $sprite.width; height = $sprite.height }
  $sprite.image.Dispose()
}
$g.Dispose()
$packed.Save((Join-Path $dir "$($PACK.name).png"), [System.Drawing.Imaging.ImageFormat]::Png)
$tileConnects = [ordered]@{}
foreach($name in $tiles.Keys){ $tileConnects[$name] = $connects[$name.Split('-')[1]] }
[ordered]@{
  image = "$($PACK.name).png"
  tileSize = $size
  frames = $frames
  # strony, z którymi kafel toru łączy się w orientacji bazowej; inne orientacje = obrót o 90° zgodnie z zegarem
  tiles = $tileConnects
  vehicles = Get-Content (Join-Path $dir 'vehicles.json') -Raw | ConvertFrom-Json
  station = Get-Content (Join-Path $dir 'station.json') -Raw | ConvertFrom-Json
  headframe = Get-Content (Join-Path $dir 'headframe.json') -Raw | ConvertFrom-Json
} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $dir "$($PACK.name).json") -Encoding UTF8
Write-Output "spritesheet : $($PACK.width)x$sheetHeight, ramek $($frames.Count)"
