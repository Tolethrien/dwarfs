param(
  [Parameter(Mandatory)][string]$source,
  [Parameter(Mandatory)][string]$name,
  [string]$base,
  [string]$bodyPath,
  [string]$dir,
  [string]$maskPath,
  [ValidateSet('','torso','hands','head')][string]$cover = '',
  [int]$threshold = 70,
  [switch]$gray
)
Add-Type -AssemblyName System.Drawing
# domyślne ścieżki liczone tutaj: przy `powershell -File` $PSScriptRoot bywa pusty w param()
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if(-not $base){ $base = Join-Path $scriptDir '..\body-guide\gen-3e.png' }
if(-not $bodyPath){ $bodyPath = Join-Path $scriptDir '..\finished\body.png' }
if(-not $dir){ $dir = Join-Path $scriptDir '..\body-guide' }
if(-not $maskPath){ $maskPath = Join-Path $scriptDir '..\body-guide\body-mask.png' }
$body = [System.Drawing.Bitmap]::new((Resolve-Path $bodyPath).Path)
$baseImg = [System.Drawing.Bitmap]::new((Resolve-Path $base).Path)
$src = [System.Drawing.Bitmap]::new((Resolve-Path $source).Path)
if($src.Width -ne $baseImg.Width -or $src.Height -ne $baseImg.Height){
  Write-Output "uwaga: $($src.Width)x$($src.Height) przeskalowane do rozmiaru bazy $($baseImg.Width)x$($baseImg.Height)"
  $resized = [System.Drawing.Bitmap]::new($baseImg.Width, $baseImg.Height)
  $g = [System.Drawing.Graphics]::FromImage($resized)
  $g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
  $g.DrawImage($src, 0, 0, $baseImg.Width, $baseImg.Height)
  $g.Dispose(); $src.Dispose(); $src = $resized
}

function isSubject($c){
  if($c.A -lt 200){ return $false }
  $max=[Math]::Max($c.R,[Math]::Max($c.G,$c.B)); $min=[Math]::Min($c.R,[Math]::Min($c.G,$c.B))
  -not ($max -gt 225 -and $max-$min -lt 30)
}

# mapowanie liczone z bazy, żeby warstwa leżała dokładnie na ciele (jak w fit-body.ps1)
$sx0=$baseImg.Width; $sy0=$baseImg.Height; $sx1=0; $sy1=0
for($y=0;$y -lt $baseImg.Height;$y+=2){for($x=0;$x -lt $baseImg.Width;$x+=2){
  if(isSubject $baseImg.GetPixel($x,$y)){ $sx0=[Math]::Min($sx0,$x);$sx1=[Math]::Max($sx1,$x);$sy0=[Math]::Min($sy0,$y);$sy1=[Math]::Max($sy1,$y) }
}}
$tx0=96;$ty0=96;$tx1=0;$ty1=0
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  if($body.GetPixel($x,$y).A -gt 0){ $tx0=[Math]::Min($tx0,$x);$tx1=[Math]::Max($tx1,$x);$ty0=[Math]::Min($ty0,$y);$ty1=[Math]::Max($ty1,$y) }
}}
$scaleX = ($sx1-$sx0+1)/($tx1-$tx0+1)
$scaleY = ($sy1-$sy0+1)/($ty1-$ty0+1)

$picked = New-Object 'System.Drawing.Color[,]' 96,96
$mark = New-Object 'bool[,]' 96,96
$diffAt = New-Object 'int[,]' 96,96
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  $sx = [int][Math]::Floor($sx0 + ($x-$tx0+0.5)*$scaleX)
  $sy = [int][Math]::Floor($sy0 + ($y-$ty0+0.5)*$scaleY)
  if($sx -lt 0 -or $sy -lt 0 -or $sx -ge $src.Width -or $sy -ge $src.Height){ continue }
  $c = $src.GetPixel($sx,$sy)
  if(-not (isSubject $c)){ continue }
  $b = $baseImg.GetPixel($sx,$sy)
  $diff = [Math]::Abs($c.R-$b.R)+[Math]::Abs($c.G-$b.G)+[Math]::Abs($c.B-$b.B)
  if(-not (isSubject $b)){ $diff = 999 }
  $picked[$x,$y] = $c
  $diffAt[$x,$y] = $diff
  $mark[$x,$y] = $diff -gt $threshold
}}

# twarz: jeden próbkowany piksel na komórkę gubi drobne zmiany (nowe oko dawało rzadki pierścień),
# więc komórka głowy jest zmieniona, gdy zmieniła się co najmniej 1/4 jej bloku w źródle
# obrys z maski wewnątrz sylwetki (np. w bliższym oku) to rysunek twarzy, nie kontur
function insideBody($x,$y){
  foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1))){
    $nx=$x+$d[0]; $ny=$y+$d[1]
    if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96 -or $body.GetPixel($nx,$ny).A -eq 0){ return $false }
  }
  $true
}
if($cover -eq 'head'){
  $headMask = [System.Drawing.Bitmap]::new((Resolve-Path $maskPath).Path)
  for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
    $m = $headMask.GetPixel($x,$y)
    if($picked[$x,$y].A -eq 0 -or $m.A -eq 0){ continue }
    $key = "$($m.R),$($m.G),$($m.B)"
    if(-not ($key -in @('84,137,171','210,21,76') -or ($key -eq '210,21,37' -and (insideBody $x $y)))){ continue }
    $bx0 = [int][Math]::Floor($sx0 + ($x-$tx0)*$scaleX); $bx1 = [int][Math]::Floor($sx0 + ($x-$tx0+1)*$scaleX)
    $by0 = [int][Math]::Floor($sy0 + ($y-$ty0)*$scaleY); $by1 = [int][Math]::Floor($sy0 + ($y-$ty0+1)*$scaleY)
    $changed = 0; $total = 0
    for($sy=$by0;$sy -lt $by1;$sy+=2){for($sx=$bx0;$sx -lt $bx1;$sx+=2){
      $c = $src.GetPixel($sx,$sy); $b = $baseImg.GetPixel($sx,$sy)
      if(([Math]::Abs($c.R-$b.R)+[Math]::Abs($c.G-$b.G)+[Math]::Abs($c.B-$b.B)) -gt $threshold){ $changed++ }
      $total++
    }}
    $mark[$x,$y] = $total -gt 0 -and $changed*4 -ge $total
  }}
  $headMask.Dispose()
}

# -cover torso: cały tułów z maski należy do warstwy (cień skóry ma kolor podobny do skórzanego stroju, porównanie tam zawodzi),
# głowa nigdy, ręce i dłonie po staremu z porównania (rękawy)
if($cover){
  $maskImg = [System.Drawing.Bitmap]::new((Resolve-Path $maskPath).Path)
  function region($x,$y){
    if($x -lt 0 -or $x -ge 96 -or $y -lt 0 -or $y -ge 96){ return 'none' }
    $m = $maskImg.GetPixel($x,$y)
    if($m.A -eq 0){ return 'none' }
    switch("$($m.R),$($m.G),$($m.B)"){
      '171,157,84' { 'torso' }
      '84,137,171' { 'head' }
      '210,21,76' { 'head' }
      '210,21,37' { 'outline' }
      default { 'limb' }
    }
  }
  function nearRegion($x,$y,$wanted){
    for($dy=-2;$dy -le 2;$dy++){for($dx=-2;$dx -le 2;$dx++){ if((region ($x+$dx) ($y+$dy)) -eq $wanted){ return $true } }}
    $false
  }
  for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
    $r = region $x $y
    # twarz: tylko zmiany wewnątrz głowy, obrys sylwetki zostaje z ciała
    if($cover -eq 'head'){
      $mark[$x,$y] = $mark[$x,$y] -and ($r -eq 'head' -or ($r -eq 'outline' -and (insideBody $x $y)))
      continue
    }
    if($cover -eq 'hands'){
      # rękawice: tylko zmiany na rękach/dłoniach i do 2 px wokół nich (rękawica bywa trochę większa niż pięść)
      if($r -ne 'limb' -and $mark[$x,$y]){ $mark[$x,$y] = nearRegion $x $y 'limb' }
      continue
    }
    if($r -eq 'head'){
      # kołnierz może zachodzić na brzeg policzka/podbródka: zmiana do 2 px od tułowia zostaje, reszta głowy nigdy
      $mark[$x,$y] = $mark[$x,$y] -and (nearRegion $x $y 'torso')
      continue
    }
    if($picked[$x,$y].A -eq 0){ continue }
    if($r -eq 'torso'){ $mark[$x,$y] = $true }
    elseif($r -eq 'outline'){
      foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1))){ if((region ($x+$d[0]) ($y+$d[1])) -eq 'torso'){ $mark[$x,$y] = $true; break } }
    }
  }}
  $maskImg.Dispose()
}

# zamknięcie dziur: piksel otoczony warstwą z >=3 stron też do niej należy
for($pass=0;$pass -lt 2;$pass++){
  $add=@()
  for($y=1;$y -lt 95;$y++){for($x=1;$x -lt 95;$x++){
    if($mark[$x,$y] -or $picked[$x,$y].A -eq 0){ continue }
    $n=[int]$mark[($x-1),$y]+[int]$mark[($x+1),$y]+[int]$mark[$x,($y-1)]+[int]$mark[$x,($y+1)]
    if($n -ge 3){ $add += ,@($x,$y) }
  }}
  foreach($p in $add){ $mark[$p[0],$p[1]] = $true }
}
# usunięcie pojedynczych wysp
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  if(-not $mark[$x,$y]){ continue }
  $n=0
  foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1),@(-1,-1),@(1,1),@(-1,1),@(1,-1))){
    $nx=$x+$d[0]; $ny=$y+$d[1]
    if($nx -ge 0 -and $nx -lt 96 -and $ny -ge 0 -and $ny -lt 96 -and $mark[$nx,$ny]){ $n++ }
  }
  if($n -eq 0){ $mark[$x,$y] = $false }
}}

function lum($c){ 0.3*$c.R+0.59*$c.G+0.11*$c.B }
function sat($c){ $max=[Math]::Max($c.R,[Math]::Max($c.G,$c.B)); $min=[Math]::Min($c.R,[Math]::Min($c.G,$c.B)); if($max -eq 0){ 0 } else { ($max-$min)/$max } }

# przy -gray: 1 = włos (wyraźnie mniej nasycony niż skóra pod nim), 3 = ciemny kontur (zostaje tylko przy włosie),
# 2 = przemalowana skóra (np. cień brody), pomijana
$kind = New-Object 'int[,]' 96,96
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  if(-not $mark[$x,$y]){ continue }
  if(-not $gray){ $kind[$x,$y]=1; continue }
  $c = $picked[$x,$y]
  $under = $body.GetPixel($x,$y)
  $limit = 0.35
  if($under.A -gt 0){ $limit = 0.65 * (sat $under) }
  if((lum $c) -lt 55){ $kind[$x,$y]=3 }
  elseif((sat $c) -lt $limit){ $kind[$x,$y]=1 }
  else { $kind[$x,$y]=2 }
}}
function hairAround($x,$y,$wanted){
  $n=0
  foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1),@(-1,-1),@(1,1),@(-1,1),@(1,-1))){
    $nx=$x+$d[0]; $ny=$y+$d[1]
    if($nx -ge 0 -and $nx -lt 96 -and $ny -ge 0 -and $ny -lt 96 -and $kind[$nx,$ny] -eq $wanted){ $n++ }
  }
  $n
}
for($pass=0;$pass -lt 2;$pass++){
  $fix=@()
  for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
    # ciepły piksel wewnątrz zarostu to włos, nie cień
    if($kind[$x,$y] -eq 2 -and (hairAround $x $y 1) -ge 5){ $fix += ,@($x,$y) }
  }}
  foreach($p in $fix){ $kind[$p[0],$p[1]]=1 }
}
if($gray){
  for($pass=0;$pass -lt 4;$pass++){
    $fix=@()
    for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
      if($kind[$x,$y] -eq 3 -and (hairAround $x $y 1) -ge 1){ $fix += ,@($x,$y) }
    }}
    foreach($p in $fix){ $kind[$p[0],$p[1]]=1 }
  }
}
# poza sylwetką ciała zostaje tylko zwarta masa włosów, nie cienkie linie (przesunięty obrys i jego otoczka)
for($pass=0;$pass -lt 3;$pass++){
  $drop=@()
  for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
    if($kind[$x,$y] -eq 1 -and $body.GetPixel($x,$y).A -eq 0 -and (hairAround $x $y 1) -lt 3){ $drop += ,@($x,$y) }
  }}
  foreach($p in $drop){ $kind[$p[0],$p[1]]=0 }
}
# zostają tylko kawałki z „rdzeniem” (piksel otoczony włosem z 8 stron); cienkie paski przemalowanego obrysu odpadają
$seen = New-Object 'bool[,]' 96,96
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  if($kind[$x,$y] -ne 1 -or $seen[$x,$y]){ continue }
  $part = New-Object System.Collections.Generic.List[int[]]
  $queue = New-Object System.Collections.Generic.Queue[int[]]
  $queue.Enqueue(@($x,$y)); $seen[$x,$y]=$true
  $hasCore = $false
  while($queue.Count -gt 0){
    $p = $queue.Dequeue(); $part.Add($p)
    if((hairAround $p[0] $p[1] 1) -eq 8){ $hasCore = $true }
    foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1),@(-1,-1),@(1,1),@(-1,1),@(1,-1))){
      $nx=$p[0]+$d[0]; $ny=$p[1]+$d[1]
      if($nx -ge 0 -and $nx -lt 96 -and $ny -ge 0 -and $ny -lt 96 -and -not $seen[$nx,$ny] -and $kind[$nx,$ny] -eq 1){ $seen[$nx,$ny]=$true; $queue.Enqueue(@($nx,$ny)) }
    }
  }
  # twarz: zmarszczki i kreski oczu są z natury cienkie, a obrysu sylwetki tryb head i tak nie bierze
  if(-not $hasCore -and $cover -ne 'head'){ foreach($p in $part){ $kind[$p[0],$p[1]]=0 } }
}}
# przy krawędzi sylwetki (do 3 px) zostają tylko piksele przy grubej masie warstwy — odcina przemalowany obrys ciała
$core = New-Object 'bool[,]' 96,96
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  if($kind[$x,$y] -eq 1 -and (hairAround $x $y 1) -eq 8){ $core[$x,$y]=$true }
}}
$drop=@()
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  # twarz: dalsze oko leży tuż przy konturze głowy
  if($kind[$x,$y] -ne 1 -or $cover -eq 'head'){ continue }
  $nearEdge=$false
  for($dy=-3;$dy -le 3 -and -not $nearEdge;$dy++){for($dx=-3;$dx -le 3;$dx++){
    $nx=$x+$dx; $ny=$y+$dy
    if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96 -or $body.GetPixel($nx,$ny).A -eq 0){ $nearEdge=$true; break }
  }}
  if(-not $nearEdge){ continue }
  $nearCore=$false
  for($dy=-1;$dy -le 1;$dy++){for($dx=-1;$dx -le 1;$dx++){
    $nx=$x+$dx; $ny=$y+$dy
    if($nx -ge 0 -and $nx -lt 96 -and $ny -ge 0 -and $ny -lt 96 -and $core[$nx,$ny]){ $nearCore=$true }
  }}
  if(-not $nearCore){ $drop += ,@($x,$y) }
}}
foreach($p in $drop){ $kind[$p[0],$p[1]]=0 }
# małe dziury (do 4 px) całkowicie otoczone zarostem → wypełnione średnim kolorem sąsiednich włosów
$seenHole = New-Object 'bool[,]' 96,96
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  if($kind[$x,$y] -eq 1 -or $seenHole[$x,$y]){ continue }
  $part = New-Object System.Collections.Generic.List[int[]]
  $queue = New-Object System.Collections.Generic.Queue[int[]]
  $queue.Enqueue(@($x,$y)); $seenHole[$x,$y]=$true
  $open = $false
  while($queue.Count -gt 0){
    $p = $queue.Dequeue(); $part.Add($p)
    foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1))){
      $nx=$p[0]+$d[0]; $ny=$p[1]+$d[1]
      if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96){ $open=$true; continue }
      if($kind[$nx,$ny] -ne 1 -and -not $seenHole[$nx,$ny]){ $seenHole[$nx,$ny]=$true; $queue.Enqueue(@($nx,$ny)) }
    }
  }
  # stroje: jasna tkanina na ręce bywa w kolorze skóry, więc dziury są większe; w zaroście większe otwory bywają celowe (usta)
  $holeMax = 4
  if(-not $gray){ $holeMax = 16 }
  if($open -or $part.Count -gt $holeMax){ continue }
  foreach($p in $part){
    $r=0;$g=0;$b=0;$n=0
    foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1),@(-1,-1),@(1,1),@(-1,1),@(1,-1))){
      $nx=$p[0]+$d[0]; $ny=$p[1]+$d[1]
      if($nx -ge 0 -and $nx -lt 96 -and $ny -ge 0 -and $ny -lt 96 -and $kind[$nx,$ny] -eq 1){ $c=$picked[$nx,$ny]; $r+=$c.R;$g+=$c.G;$b+=$c.B;$n++ }
    }
    if($n -gt 0){ $picked[$p[0],$p[1]] = [System.Drawing.Color]::FromArgb(255,[int]($r/$n),[int]($g/$n),[int]($b/$n)) }
  }
  foreach($p in $part){ $kind[$p[0],$p[1]]=1 }
}}
# hełmy, rękawice i narzędzia: materiał w kolorze zbliżonym do skóry (wełna, skóra) wypada z porównania i robi dziury.
# Łata bierze piksel z obrazu Codexa, gdy jest zamknięty w warstwie (dziura do 60 px albo wcięcie >=5 z 8 sąsiadów)
# i wyraźnie różni się od bazy; nietknięta twarz w otworze kaptura różni się prawie wcale, więc zostaje poza warstwą
if((-not $cover -or $cover -eq 'hands') -and -not $gray){
  $patchMinDiff = 25
  $dirs4 = @(@(-1,0),@(1,0),@(0,-1),@(0,1)); $dirs8 = $dirs4 + @(@(-1,-1),@(1,1),@(-1,1),@(1,-1))
  $patched = 0
  $seenGap = New-Object 'bool[,]' 96,96
  for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
    if($seenGap[$x,$y] -or $kind[$x,$y] -eq 1 -or $picked[$x,$y].A -eq 0){ continue }
    $part = New-Object System.Collections.Generic.List[int[]]
    $queue = New-Object System.Collections.Generic.Queue[int[]]
    $queue.Enqueue(@($x,$y)); $seenGap[$x,$y] = $true; $open = $false
    while($queue.Count -gt 0){
      $p = $queue.Dequeue(); $part.Add($p)
      foreach($d in $dirs4){
        $nx=$p[0]+$d[0]; $ny=$p[1]+$d[1]
        if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96 -or $picked[$nx,$ny].A -eq 0){ $open = $true; continue }
        if(-not $seenGap[$nx,$ny] -and $kind[$nx,$ny] -ne 1){ $seenGap[$nx,$ny] = $true; $queue.Enqueue(@($nx,$ny)) }
      }
    }
    if($open -or $part.Count -gt 60){ continue }
    foreach($p in $part){ if($diffAt[$p[0],$p[1]] -gt $patchMinDiff){ $kind[$p[0],$p[1]] = 1; $patched++ } }
  }}
  for($pass=0;$pass -lt 4;$pass++){
    $add = @()
    for($y=1;$y -lt 95;$y++){for($x=1;$x -lt 95;$x++){
      if($kind[$x,$y] -eq 1 -or $picked[$x,$y].A -eq 0 -or $diffAt[$x,$y] -le $patchMinDiff){ continue }
      $n = 0; foreach($d in $dirs8){ if($kind[($x+$d[0]),($y+$d[1])] -eq 1){ $n++ } }
      if($n -ge 5){ $add += ,@($x,$y) }
    }}
    foreach($p in $add){ $kind[$p[0],$p[1]] = 1; $patched++ }
  }
  Write-Output "latanie dziur z obrazu zrodlowego: +$patched px"
}

# stroje: sprzątanie pod inne kolory skóry
if($cover -eq 'torso'){
  $torsoMask = [System.Drawing.Bitmap]::new((Resolve-Path $maskPath).Path)
  $dirs4 = @(@(-1,0),@(1,0),@(0,-1),@(0,1)); $dirs8 = $dirs4 + @(@(-1,-1),@(1,1),@(-1,1),@(1,-1))
  # 1) Codex maluje dolny brzeg rękawa kolorem jasnej skóry: piksel w kolorze skóry tuż nad gołą ręką odpada
  $hem = 0
  for($y=0;$y -lt 93;$y++){for($x=0;$x -lt 96;$x++){
    if($kind[$x,$y] -ne 1){ continue }
    $m = $torsoMask.GetPixel($x,$y); $key = "$($m.R),$($m.G),$($m.B)"
    if($key -eq '171,157,84' -or $key -eq '84,137,171'){ continue }
    $c = $picked[$x,$y]; $h = $c.GetHue()
    if(-not ($h -ge 5 -and $h -le 25 -and $c.GetSaturation() -ge 0.35 -and ($c.R+$c.G+$c.B) -gt 150)){ continue }
    for($dy=1;$dy -le 3;$dy++){
      if($kind[$x,($y+$dy)] -ne 1 -and $body.GetPixel($x,$y+$dy).A -gt 0){ $kind[$x,$y] = 0; $hem++; break }
    }
  }}
  # 2) dziury: zamknięte (do 60 px) i wcięcia (piksel ciała z >=5 z 8 sąsiadów w warstwie); przez nie widać skórę
  $toFill = New-Object System.Collections.Generic.List[int[]]
  $seenGap = New-Object 'bool[,]' 96,96
  for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
    if($seenGap[$x,$y] -or $kind[$x,$y] -eq 1 -or $body.GetPixel($x,$y).A -eq 0){ continue }
    $part = New-Object System.Collections.Generic.List[int[]]
    $queue = New-Object System.Collections.Generic.Queue[int[]]
    $queue.Enqueue(@($x,$y)); $seenGap[$x,$y] = $true; $open = $false
    while($queue.Count -gt 0){
      $p = $queue.Dequeue(); $part.Add($p)
      foreach($d in $dirs4){
        $nx=$p[0]+$d[0]; $ny=$p[1]+$d[1]
        if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96 -or $body.GetPixel($nx,$ny).A -eq 0){ $open = $true; continue }
        if(-not $seenGap[$nx,$ny] -and $kind[$nx,$ny] -ne 1){ $seenGap[$nx,$ny] = $true; $queue.Enqueue(@($nx,$ny)) }
      }
    }
    if(-not $open -and $part.Count -le 60){ foreach($p in $part){ $toFill.Add($p) } }
  }}
  $filled = New-Object 'bool[,]' 96,96
  foreach($p in $toFill){ $filled[$p[0],$p[1]] = $true }
  for($pass=0;$pass -lt 4;$pass++){
    $add = @()
    for($y=1;$y -lt 95;$y++){for($x=1;$x -lt 95;$x++){
      if($kind[$x,$y] -eq 1 -or $filled[$x,$y] -or $body.GetPixel($x,$y).A -eq 0){ continue }
      $n = 0; foreach($d in $dirs8){ if($kind[($x+$d[0]),($y+$d[1])] -eq 1 -or $filled[($x+$d[0]),($y+$d[1])]){ $n++ } }
      if($n -ge 5){ $add += ,@($x,$y) }
    }}
    foreach($p in $add){ $filled[$p[0],$p[1]] = $true; $toFill.Add($p) }
  }
  # wypełnianie od brzegu do środka średnią z sąsiadów warstwy
  $pending = [System.Collections.Generic.List[int[]]]::new($toFill)
  while($pending.Count -gt 0){
    $done = @(); $next = New-Object System.Collections.Generic.List[int[]]
    foreach($p in $pending){
      $r=0;$g=0;$b=0;$n=0
      foreach($d in $dirs8){
        $nx=$p[0]+$d[0]; $ny=$p[1]+$d[1]
        if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96 -or $kind[$nx,$ny] -ne 1){ continue }
        $c=$picked[$nx,$ny]; $r+=$c.R;$g+=$c.G;$b+=$c.B;$n++
      }
      if($n -ge 2){ $done += ,@($p[0],$p[1],[int]($r/$n),[int]($g/$n),[int]($b/$n)) } else { $next.Add($p) }
    }
    if($done.Count -eq 0){ break }
    foreach($p in $done){ $picked[$p[0],$p[1]] = [System.Drawing.Color]::FromArgb(255,$p[2],$p[3],$p[4]); $kind[$p[0],$p[1]] = 1 }
    $pending = $next
  }
  Write-Output "sprzatanie stroju: brzeg rekawa -$hem px, dziury i wciecia +$($toFill.Count - $pending.Count) px"
  $torsoMask.Dispose()
}

$lumMax = 0
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  if($kind[$x,$y] -eq 1){ $lumMax=[Math]::Max($lumMax,(lum $picked[$x,$y])) }
}}

$layer = [System.Drawing.Bitmap]::new(96,96)
$count = 0
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  $c = $picked[$x,$y]
  if($kind[$x,$y] -eq 1){
    if($gray){
      $v = [int][Math]::Min(255, (lum $c) / $lumMax * 245)
      $c = [System.Drawing.Color]::FromArgb(255,$v,$v,$v)
    }
    $layer.SetPixel($x,$y,[System.Drawing.Color]::FromArgb(255,$c.R,$c.G,$c.B))
    $count++
  }
}}
$layer.Save((Join-Path $dir "$name-96.png"),[System.Drawing.Imaging.ImageFormat]::Png)
# nowa twarz = gotowy wariant ciała: body.png z podmienionymi pikselami głowy
if($cover -eq 'head'){
  $variant = [System.Drawing.Bitmap]::new($body)
  for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
    if($kind[$x,$y] -eq 1){ $variant.SetPixel($x,$y,$layer.GetPixel($x,$y)) }
  }}
  $variant.Save((Join-Path $dir "$name-body.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $variant.Dispose()
}

function upscale($bmp,$path,$bg){
  $big=[System.Drawing.Bitmap]::new($bmp.Width*8,$bmp.Height*8)
  $g=[System.Drawing.Graphics]::FromImage($big); $g.Clear($bg)
  $g.InterpolationMode='NearestNeighbor'; $g.PixelOffsetMode='Half'
  $g.DrawImage($bmp,0,0,$big.Width,$big.Height); $big.Save($path); $g.Dispose(); $big.Dispose()
}
upscale $layer (Join-Path $dir "$name-8x.png") ([System.Drawing.Color]::FromArgb(255,40,40,48))

# podgląd: ciało + warstwa w kilku kolorach (multiply)
if($gray){
  $tints=@(@(196,92,48),@(120,72,40),@(60,44,36),@(200,200,196),@(232,196,120))
  $sheetOut=[System.Drawing.Bitmap]::new(96*$tints.Count,96)
  for($i=0;$i -lt $tints.Count;$i++){
    $t=$tints[$i]
    for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
      $c=$body.GetPixel($x,$y)
      if($kind[$x,$y] -eq 1){ $v=$layer.GetPixel($x,$y).R/255; $c=[System.Drawing.Color]::FromArgb(255,[int]($t[0]*$v),[int]($t[1]*$v),[int]($t[2]*$v)) }
      if($c.A -gt 0){ $sheetOut.SetPixel($i*96+$x,$y,$c) }
    }}
  }
  upscale $sheetOut (Join-Path $dir "$name-tints.png") ([System.Drawing.Color]::FromArgb(255,40,40,48))
  $sheetOut.Dispose()
}
else {
  # podgląd: ciało + warstwa, potem to samo z każdą brodą z finished/ (rudy tint) na wierzchu
  $beardFiles = @(Get-ChildItem (Split-Path $bodyPath) -Filter 'beard-*.png' | Sort-Object Name)
  # kolejność jak w build-sheet: narzędzie, dłoń, rękawice i hełm leżą nad brodą
  $layerAbove = $name -match '^(tool|hand|gloves|helmet)'
  $sheetOut = [System.Drawing.Bitmap]::new(96*(1+$beardFiles.Count),96)
  for($i=0;$i -le $beardFiles.Count;$i++){
    $beard = $null
    if($i -gt 0){ $beard = [System.Drawing.Bitmap]::new($beardFiles[$i-1].FullName) }
    for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
      $c=$body.GetPixel($x,$y)
      if($kind[$x,$y] -eq 1 -and -not $layerAbove){ $c=$layer.GetPixel($x,$y) }
      if($beard){ $h=$beard.GetPixel($x,$y); if($h.A -gt 0){ $v=$h.R/255; $c=[System.Drawing.Color]::FromArgb(255,[int](196*$v),[int](92*$v),[int](48*$v)) } }
      if($kind[$x,$y] -eq 1 -and $layerAbove){ $c=$layer.GetPixel($x,$y) }
      if($c.A -gt 0){ $sheetOut.SetPixel($i*96+$x,$y,$c) }
    }}
    if($beard){ $beard.Dispose() }
  }
  upscale $sheetOut (Join-Path $dir "$name-preview.png") ([System.Drawing.Color]::FromArgb(255,40,40,48))
  $sheetOut.Dispose()
}
Write-Output "$name : $count px warstwy, prog $threshold"
$layer.Dispose(); $src.Dispose(); $baseImg.Dispose(); $body.Dispose()

