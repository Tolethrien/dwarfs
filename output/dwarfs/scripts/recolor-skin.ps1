param([string]$source, [string[]]$tones, [string]$dir)
Add-Type -AssemblyName System.Drawing
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if(-not $source){ $source = Join-Path $scriptDir '..\finished\body.png' }
if(-not $dir){ $dir = Join-Path $scriptDir '..\body-guide' }
$finished = Join-Path $scriptDir '..\finished'

# hue: przesunięcie odcienia w stopniach, sat: mnożnik nasycenia, low/high: zakres jasności skóry (V w HSV) po zmianie,
# outline: mnożnik obrysu (przy ciemnej skórze obrys też ciemnieje, żeby odcinał się od cieni)
$palette = [ordered]@{
  tan   = @{ hue=3;  sat=0.95; low=0.20; high=0.80; outline=0.85 }
  brown = @{ hue=5;  sat=0.92; low=0.17; high=0.62; outline=0.65 }
  dark  = @{ hue=4;  sat=0.85; low=0.14; high=0.46; outline=0.45 }
}
if($tones){ $tones = @($tones -split ",") } else { $tones = @($palette.Keys) }
$outlineMax = 60

function toHsv($c){
  $r=$c.R/255.0; $g=$c.G/255.0; $b=$c.B/255.0
  $max=[Math]::Max($r,[Math]::Max($g,$b)); $min=[Math]::Min($r,[Math]::Min($g,$b)); $d=$max-$min
  $h=0
  if($d -gt 0){
    if($max -eq $r){ $h=60*((($g-$b)/$d)%6) } elseif($max -eq $g){ $h=60*(($b-$r)/$d+2) } else { $h=60*(($r-$g)/$d+4) }
  }
  if($h -lt 0){ $h+=360 }
  $s=0; if($max -gt 0){ $s=$d/$max }
  @($h,$s,$max)
}
function fromHsv($h,$s,$v){
  $h=(($h%360)+360)%360; $c=$v*$s; $x=$c*(1-[Math]::Abs((($h/60)%2)-1)); $m=$v-$c
  $rgb = switch([int][Math]::Floor($h/60)){ 0{@($c,$x,0)} 1{@($x,$c,0)} 2{@(0,$c,$x)} 3{@(0,$x,$c)} 4{@($x,0,$c)} default{@($c,0,$x)} }
  [System.Drawing.Color]::FromArgb(255,[int](($rgb[0]+$m)*255),[int](($rgb[1]+$m)*255),[int](($rgb[2]+$m)*255))
}
# skóra = ciepły odcień (czerwień nosa i policzków też), nasycony albo bardzo jasny (highlight); białka i tęczówki zostają
function isSkin($hsv){ ($hsv[0] -ge 340 -or $hsv[0] -le 45) -and ($hsv[1] -ge 0.25 -or $hsv[2] -ge 0.85) }

$src = [System.Drawing.Bitmap]::new((Resolve-Path $source).Path)
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($source)
$results = [ordered]@{ original = [System.Drawing.Bitmap]::new($src) }
$v0 = $outlineMax/255
foreach($tone in $tones){
  $t = $palette[$tone]
  if(-not $t){ throw "nieznany odcień $tone (są: $($palette.Keys -join ', '))" }
  $out = [System.Drawing.Bitmap]::new(96,96)
  $kept = 0
  for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
    $c = $src.GetPixel($x,$y)
    if($c.A -eq 0){ continue }
    if([Math]::Max($c.R,[Math]::Max($c.G,$c.B)) -le $outlineMax){
      $out.SetPixel($x,$y,[System.Drawing.Color]::FromArgb($c.A,[int]($c.R*$t.outline),[int]($c.G*$t.outline),[int]($c.B*$t.outline)))
      continue
    }
    $hsv = toHsv $c
    if(-not (isSkin $hsv)){ $out.SetPixel($x,$y,$c); $kept++; continue }
    $v = $t.low + ($hsv[2]-$v0)/(1-$v0)*($t.high-$t.low)
    $out.SetPixel($x,$y,(fromHsv ($hsv[0]+$t.hue) ([Math]::Min(1.0,$hsv[1]*$t.sat)) $v))
  }}
  $out.Save((Join-Path $dir "$baseName-$tone.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "$baseName-$tone : poza skórą zostało $kept px (oczy itp.)"
  $results[$tone] = $out
}

# podgląd: wiersz = odcień, kolumny: samo ciało, ciemna broda, jasna broda, miner + ruda krótka + hełm, intern + siwe warkocze
function layer($file){ $path = Join-Path $finished $file; if(Test-Path $path){ [System.Drawing.Bitmap]::new($path) } }
$columns = @(
  @(),
  @(@{ file='beard-full.png'; tint=@(60,44,36) }),
  @(@{ file='beard-full.png'; tint=@(200,200,196) }),
  @(@{ file='armor-miner.png' }, @{ file='beard-short-a.png'; tint=@(196,92,48) }, @{ file='helmet-leather.png' }),
  @(@{ file='armor-intern.png' }, @{ file='beard-braids.png'; tint=@(232,228,220) })
)
$scale=5; $pad=8
$sheet = [System.Drawing.Bitmap]::new($pad+$columns.Count*(96*$scale+$pad)+$columns.Count*(96+$pad), $pad+$results.Count*(96*$scale+$pad))
$gr = [System.Drawing.Graphics]::FromImage($sheet); $gr.Clear([System.Drawing.Color]::FromArgb(255,40,40,48))
$gr.InterpolationMode='NearestNeighbor'; $gr.PixelOffsetMode='Half'
$row=0
foreach($tone in $results.Keys){
  for($col=0;$col -lt $columns.Count;$col++){
    $img = [System.Drawing.Bitmap]::new($results[$tone])
    foreach($part in $columns[$col]){
      $l = layer $part.file; if(-not $l){ continue }
      for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
        $p=$l.GetPixel($x,$y); if($p.A -eq 0){ continue }
        if($part.tint){ $k=$p.R/255.0; $p=[System.Drawing.Color]::FromArgb(255,[int]($part.tint[0]*$k),[int]($part.tint[1]*$k),[int]($part.tint[2]*$k)) }
        $img.SetPixel($x,$y,$p)
      }}
      $l.Dispose()
    }
    $y0 = $pad+$row*(96*$scale+$pad)
    $gr.DrawImage($img,$pad+$col*(96*$scale+$pad),$y0,96*$scale,96*$scale)
    $gr.DrawImage($img,$pad+$columns.Count*(96*$scale+$pad)+$col*(96+$pad),$y0,96,96)
    $img.Dispose()
  }
  $gr.DrawString($tone,[System.Drawing.Font]::new('Segoe UI',11),[System.Drawing.Brushes]::White,$pad+$columns.Count*(96*$scale+$pad),$y0+100)
  $row++
}
$sheet.Save((Join-Path $dir "$baseName-skins-preview.png"))
$gr.Dispose(); $sheet.Dispose(); foreach($b in $results.Values){ $b.Dispose() }; $src.Dispose()
