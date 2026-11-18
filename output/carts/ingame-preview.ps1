param([int]$scale = 1)
Add-Type -AssemblyName System.Drawing
$root = 'C:\coding\projekty\gry\dwarfs'
$assets = "$root\src\sandbox\assets"
$final = "$root\output\carts\final"
$size = 96
$columns = 14; $rows = 9

# brązowa skała: RAMPS.rock[brown] z blocks.ts, mapowanie jak tileRampColor w tileSolid.wgsl (TOP 0.6, MID 0.48)
$ramp = @{ shadow = @(34,22,32); mid = @(106,80,60); light = @(174,138,98) }
function rampColor($brightness){
  $t = [Math]::Min(1, [Math]::Max(0, $brightness / 0.6))
  if($t -lt 0.48){ $a = $ramp.shadow; $b = $ramp.mid; $k = $t / 0.48 } else { $a = $ramp.mid; $b = $ramp.light; $k = ($t - 0.48) / 0.52 }
  [System.Drawing.Color]::FromArgb(255, [int]($a[0] + ($b[0]-$a[0])*$k), [int]($a[1] + ($b[1]-$a[1])*$k), [int]($a[2] + ($b[2]-$a[2])*$k))
}
$atlas = [System.Drawing.Bitmap]::new("$assets\rocks-neutral.png")
$rockTiles = @()
foreach($column in 0..7){
  $tile = [System.Drawing.Bitmap]::new($size, $size)
  for($y=0;$y -lt $size;$y++){ for($x=0;$x -lt $size;$x++){
    $c = $atlas.GetPixel($column*$size + $x, $y)
    $tile.SetPixel($x, $y, (rampColor ([Math]::Pow((0.2126*$c.R + 0.7152*$c.G + 0.0722*$c.B)/255, 1.6))))
  }}
  $rockTiles += $tile
}

# korytarz 3 kafle wysokości (rzędy 2-4) i szyb 3 kafle szerokości (kolumny 9-11) w dół
function isOpen($column, $row){ ($row -ge 2 -and $row -le 4 -and $column -le 11) -or ($column -ge 9 -and $column -le 11 -and $row -ge 2) }

$bg = [System.Drawing.Bitmap]::new("$assets\bg.png")
$sheet = @{}
foreach($name in 'rail-straight','rail-corner','beam-straight','beam-mount','beam-corner'){ $sheet[$name] = [System.Drawing.Bitmap]::new("$final\$name.png") }
function turned($name, $turns){
  $bmp = $sheet[$name].Clone()
  switch($turns){ 1 { $bmp.RotateFlip('Rotate90FlipNone') } 2 { $bmp.RotateFlip('Rotate180FlipNone') } 3 { $bmp.RotateFlip('Rotate270FlipNone') } }
  $bmp
}
# tor: środkowy rząd korytarza do kolumny 10, tam narożnik (lewo+dół) i w dół szybem
$track = @{}
# stacja = węzeł na kaflu 7, jej sprite zajmuje kafle 5-9 (tor ma wpieczony), tam gra nie rysuje kafli toru
for($column=0;$column -lt 10;$column++){ if($column -lt 5 -or $column -gt 9){ $track["$column,3"] = @('straight', 0) } }
$track["10,3"] = @('corner', 0)
for($row=4;$row -lt $rows;$row++){ $track["10,$row"] = @('straight', 1) }

$dwarf = [System.Drawing.Bitmap]::new($size, $size)
$g = [System.Drawing.Graphics]::FromImage($dwarf)
foreach($file in 'body.png','armor-miner.png','gloves-leather.png','helmet-leather.png'){ $g.DrawImage([System.Drawing.Bitmap]::new("$root\output\dwarfs\finished\$file"), 0, 0, $size, $size) }
$g.Dispose()

$image = [System.Drawing.Bitmap]::new($columns*$size, $rows*$size)
$g = [System.Drawing.Graphics]::FromImage($image)
$g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
# tło: kafelek z lewego górnego rogu bg.png (192×96), powtarzany
for($y=0;$y -lt $rows*$size;$y+=96){ for($x=0;$x -lt $columns*$size;$x+=192){ $g.DrawImage($bg, [System.Drawing.Rectangle]::new($x,$y,192,96), 0, 0, 192, 96, 'Pixel') } }
$random = [System.Random]::new(7)
for($row=0;$row -lt $rows;$row++){ for($column=0;$column -lt $columns;$column++){
  if(-not (isOpen $column $row)){ $variant = if($random.NextDouble() -lt 0.7){ 0 } else { 1 + $random.Next(7) }; $g.DrawImage($rockTiles[$variant], $column*$size, $row*$size) }
}}
# stacja na torze w korytarzu: tył pod belką i szyną, przód na końcu (po wagonie i kolejce)
$station = Get-Content "$final\station.json" -Raw | ConvertFrom-Json
$stationAt = @{ x = [int](5*$size); y = [int](3*$size + $size/2 - $station.pivot.y) }
$g.DrawImage([System.Drawing.Bitmap]::new("$final\station-back.png"), $stationAt.x, $stationAt.y)
foreach($layer in 'beam','rail'){
  foreach($key in $track.Keys){
    $cell = $key.Split(','); $piece = $track[$key]
    $name = "$layer-$($piece[0])"
    if($layer -eq 'beam' -and $piece[0] -eq 'straight' -and ([int]$cell[0] + [int]$cell[1]) % 3 -eq 0){ $name = 'beam-mount' }
    $g.DrawImage((turned $name $piece[1]), [int]$cell[0]*$size, [int]$cell[1]*$size, $size, $size)
  }
}
# krasnolud na dnie korytarza i drugi w szybie, w skali gry
$g.DrawImage($dwarf, 3*$size, 4*$size, $size, $size)
$g.DrawImage($dwarf, 9*$size + 4, 8*$size - 10, $size, $size)
# wagony: pivot (środek bryły) na osi szyny; załadowany w korytarzu, pusty w szybie
$vehicles = Get-Content "$final\vehicles.json" -Raw | ConvertFrom-Json
$pivot = $vehicles.cart.pivot
$g.DrawImage([System.Drawing.Bitmap]::new("$final\cart-loaded.png"), [int](1.2*$size - $pivot.x), [int](3*$size + $size/2 - $pivot.y))
# gondole: kulki z pełnej tekstury 96, płynnie, rysowane POD gondolą w jej seats; puste okno pokazuje świat.
# Jedna w korytarzu (dwie kulki), druga na pionowym odcinku w szybie (trzy kulki)
$gondola = $vehicles.gondola
$CREW = @(
  @{ layers = @('body.png','armor-miner.png','beard-full.png','gloves-leather.png','helmet-leather.png'); beard = @(196,104,52) },
  @{ layers = @('body-blue-dark.png','armor-iron.png','beard-braids.png','gloves-iron.png','helmet-iron.png'); beard = @(70,52,42) },
  @{ layers = @('body-squint-light.png','armor-driller.png','beard-walrus.png','gloves-driller.png','helmet-goggles.png'); beard = @(205,200,190) }
)
function riderImage($rider){
  $full = [System.Drawing.Bitmap]::new($size, $size)
  foreach($file in $rider.layers){
    $layer = [System.Drawing.Bitmap]::new("$root\output\dwarfs\finished\$file")
    if($file -like 'beard-*'){
      for($y=0;$y -lt $size;$y++){ for($x=0;$x -lt $size;$x++){
        $c = $layer.GetPixel($x,$y)
        if($c.A -gt 0){ $layer.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($c.A, [int]($c.R*$rider.beard[0]/255), [int]($c.G*$rider.beard[1]/255), [int]($c.B*$rider.beard[2]/255))) }
      }}
    }
    $fg = [System.Drawing.Graphics]::FromImage($full); $fg.DrawImage($layer, 0, 0, $size, $size); $fg.Dispose()
  }
  $full
}
$riders = @($CREW | ForEach-Object { riderImage $_ })
function drawGondola($railX, $railY, $count){
  $at = @{ x = [int]($railX - $gondola.pivot.x); y = [int]($railY - $gondola.pivot.y) }
  $riderSize = $gondola.rider.size
  $g.InterpolationMode = 'HighQualityBicubic'
  for($index=0;$index -lt $count;$index++){
    $seat = $gondola.seats[$index]
    $g.DrawImage($riders[$index], [int]($at.x + $seat.x - $riderSize/2), [int]($at.y + $seat.y - $riderSize/2 + $gondola.rider.offsetY), $riderSize, $riderSize)
  }
  $g.InterpolationMode = 'NearestNeighbor'
  $g.DrawImage([System.Drawing.Bitmap]::new("$final\gondola.png"), $at.x, $at.y)
  $at
}
$gondolaAt = drawGondola (7.5*$size) (3*$size + $size/2) 1
$null = drawGondola (10*$size + $size/2) (6*$size + $size/2) 3
$g.DrawImage([System.Drawing.Bitmap]::new("$final\cart-empty.png"), [int](3.4*$size - $pivot.x), [int](3*$size + $size/2 - $pivot.y))
# kolejka na peronie przed wagonem: 6 z 8 miejsc zajęte (nachodzą na siebie), kulki mocno zmniejszone, z pełnej tekstury
$g.InterpolationMode = 'HighQualityBicubic'
$queueSize = $station.queue.size
for($index=0;$index -lt 4;$index++){
  $spot = $station.queue.spots[$index]
  $g.DrawImage($riders[$index % $riders.Count], [int]($stationAt.x + $spot.x - $queueSize/2), [int]($stationAt.y + $spot.y - $queueSize/2), $queueSize, $queueSize)
}
# ładunek w prawej połowie peronu: wszystkie 4 miejsca, mieszanka skrzyń i beczek
$cargoSize = $station.cargo.size
$cargoOrder = @('cargo-crate-a','cargo-barrel-a','cargo-crate-b','cargo-barrel-b')
for($index=0;$index -lt 4;$index++){
  $spot = $station.cargo.spots[$index]
  $g.DrawImage([System.Drawing.Bitmap]::new("$final\$($cargoOrder[$index]).png"), [int]($stationAt.x + $spot.x - $cargoSize/2), [int]($stationAt.y + $spot.y - $cargoSize/2), $cargoSize, $cargoSize)
}
$g.InterpolationMode = 'NearestNeighbor'
$g.DrawImage([System.Drawing.Bitmap]::new("$final\station-front.png"), $stationAt.x, $stationAt.y)
$g.Dispose()

$out = [System.Drawing.Bitmap]::new($columns*$size*$scale, $rows*$size*$scale)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.DrawImage($image, 0, 0, $columns*$size*$scale, $rows*$size*$scale)
$g.Dispose()
$out.Save("$root\output\carts\previews\ingame-preview.png", [System.Drawing.Imaging.ImageFormat]::Png)
$half = [System.Drawing.Bitmap]::new($columns*$size/2, $rows*$size/2)
$g = [System.Drawing.Graphics]::FromImage($half); $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
$g.DrawImage($image, 0, 0, $columns*$size/2, $rows*$size/2); $g.Dispose()
$half.Save("$root\output\carts\previews\ingame-preview-zoom05.png", [System.Drawing.Imaging.ImageFormat]::Png)

# zbliżenie stacji (z gondolą i kolejką) ×2
$zoom = 2
$crop = [System.Drawing.Rectangle]::new($stationAt.x - 30, $stationAt.y - 20, $station.width + 60, $station.height + 40)
$close = [System.Drawing.Bitmap]::new($crop.Width*$zoom, $crop.Height*$zoom)
$g = [System.Drawing.Graphics]::FromImage($close); $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.DrawImage($image, [System.Drawing.Rectangle]::new(0, 0, $close.Width, $close.Height), $crop, 'Pixel'); $g.Dispose()
$close.Save("$root\output\carts\previews\station-closeup.png", [System.Drawing.Imaging.ImageFormat]::Png)

# cały zjazd: nadszybie na powierzchni, szyb 3 kafle w dół, stacja szybowa na dole w korytarzu.
# Platformy: na starcie (pomost na gruncie), w połowie szybu i zadokowana w stacji. Kolejność: nadszybie tył → szyb →
# kulki → platformy → nadszybie przód → tył stacji → tor → wagon → kolejka → przód stacji
$columns = 11; $rows = 16
$groundRow = 6
$node = @{ x = 5; y = 13 }
$scene = [System.Drawing.Bitmap]::new($columns*$size, $rows*$size)
$g = [System.Drawing.Graphics]::FromImage($scene)
$g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
$g.Clear([System.Drawing.Color]::FromArgb(255, 62, 58, 78))
for($y=$groundRow*$size;$y -lt $rows*$size;$y+=96){ for($x=0;$x -lt $columns*$size;$x+=192){ $g.DrawImage($bg, [System.Drawing.Rectangle]::new($x,$y,192,96), 0, 0, 192, 96, 'Pixel') } }
$random = [System.Random]::new(11)
for($row=$groundRow;$row -lt $rows;$row++){ for($column=0;$column -lt $columns;$column++){
  $open = ($row -ge $node.y - 1 -and $row -le $node.y + 1) -or ($column -ge $node.x - 1 -and $column -le $node.x + 1 -and $row -le $node.y)
  if(-not $open){ $variant = if($random.NextDouble() -lt 0.7){ 0 } else { 1 + $random.Next(7) }; $g.DrawImage($rockTiles[$variant], $column*$size, $row*$size) }
}}
$headframe = Get-Content "$final\headframe.json" -Raw | ConvertFrom-Json
$shaftX = ($node.x + 0.5) * $size
$groundY = $groundRow * $size
$headAt = @{ x = [int]($shaftX - $headframe.pivot.x); y = [int]($groundY - $headframe.pivot.y) }
$g.DrawImage([System.Drawing.Bitmap]::new("$final\headframe-back.png"), $headAt.x, $headAt.y)
$shaftSegment = [System.Drawing.Bitmap]::new("$final\shaft-segment.png")
$shaftBack = [System.Drawing.Bitmap]::new((Join-Path $final 'shaft-back.png'))
for($row=$groundRow;$row -le $node.y + 1;$row++){ $g.DrawImage($shaftBack, ($node.x - 1)*$size, $row*$size); $g.DrawImage($shaftSegment, ($node.x - 1)*$size, $row*$size) }
$stationAt = @{ x = [int]($shaftX - $station.pivot.x); y = [int](($node.y + 0.5)*$size - $station.pivot.y) }
$liftPlatform = [System.Drawing.Bitmap]::new("$final\lift-platform.png")
$platformInfo = $station.shaft.platform
$deckStops = @($groundY, ($groundY + 3.5 * $size), ($stationAt.y + $station.shaft.deckY))
for($index=0;$index -lt $deckStops.Count;$index++){
  $deckY = $deckStops[$index]
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($riders[$index % $riders.Count], [int]($shaftX - $size/2), [int]($deckY - 92), $size, $size)
  $g.InterpolationMode = 'NearestNeighbor'
  $g.DrawImage($liftPlatform, [int]($shaftX - $platformInfo.pivot.x), [int]($deckY - $platformInfo.pivot.y))
}
$g.DrawImage([System.Drawing.Bitmap]::new("$final\headframe-front.png"), $headAt.x, $headAt.y)
$g.DrawImage([System.Drawing.Bitmap]::new("$final\station-shaft-back.png"), $stationAt.x, $stationAt.y)
foreach($layer in 'beam','rail'){
  for($column=0;$column -lt $columns;$column++){
    if([Math]::Abs($column - $node.x) -le 2){ continue }
    $name = if($layer -eq 'beam' -and $column % 3 -eq 0){ 'beam-mount' } else { "$layer-straight" }
    $g.DrawImage((turned $name 0), $column*$size, $node.y*$size, $size, $size)
  }
}
$cartPivot = $vehicles.cart.pivot
$g.DrawImage([System.Drawing.Bitmap]::new("$final\cart-loaded.png"), [int]($shaftX - $cartPivot.x), [int](($node.y + 0.5)*$size - $cartPivot.y))
$g.InterpolationMode = 'HighQualityBicubic'
for($index=0;$index -lt 3;$index++){
  $spot = $station.queue.spots[$index]
  $g.DrawImage($riders[($index + 1) % $riders.Count], [int]($stationAt.x + $spot.x - $queueSize/2), [int]($stationAt.y + $spot.y - $queueSize/2), $queueSize, $queueSize)
}
$g.InterpolationMode = 'NearestNeighbor'
$g.DrawImage([System.Drawing.Bitmap]::new("$final\station-front.png"), $stationAt.x, $stationAt.y)
$g.Dispose()
$half = [System.Drawing.Bitmap]::new($columns*$size/2, $rows*$size/2)
$g = [System.Drawing.Graphics]::FromImage($half); $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
$g.DrawImage($scene, 0, 0, $columns*$size/2, $rows*$size/2); $g.Dispose()
$scene.Save("$root\output\carts\previews\shaft-preview.png", [System.Drawing.Imaging.ImageFormat]::Png)
$half.Save("$root\output\carts\previews\shaft-preview-zoom05.png", [System.Drawing.Imaging.ImageFormat]::Png)
