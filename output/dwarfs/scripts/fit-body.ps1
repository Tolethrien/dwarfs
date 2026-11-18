param([Parameter(Mandatory)][string]$source, [switch]$keepFace)
Add-Type -AssemblyName System.Drawing
$dir = $PSScriptRoot
$sheet = [System.Drawing.Bitmap]::new((Join-Path $dir '..\maker.png'))
$src = [System.Drawing.Bitmap]::new((Resolve-Path $source).Path)

function isSubject($c){ $c.A -ge 200 -and -not ($c.R -gt 235 -and $c.G -gt 235 -and $c.B -gt 235) }

$sx0=$src.Width; $sy0=$src.Height; $sx1=0; $sy1=0
for($y=0;$y -lt $src.Height;$y+=2){for($x=0;$x -lt $src.Width;$x+=2){
  if(isSubject $src.GetPixel($x,$y)){ $sx0=[Math]::Min($sx0,$x);$sx1=[Math]::Max($sx1,$x);$sy0=[Math]::Min($sy0,$y);$sy1=[Math]::Max($sy1,$y) }
}}
$tx0=96;$ty0=96;$tx1=0;$ty1=0
for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
  if($sheet.GetPixel($x+96,$y).A -gt 0){ $tx0=[Math]::Min($tx0,$x);$tx1=[Math]::Max($tx1,$x);$ty0=[Math]::Min($ty0,$y);$ty1=[Math]::Max($ty1,$y) }
}}
$scaleX = ($sx1-$sx0+1)/($tx1-$tx0+1)
$scaleY = ($sy1-$sy0+1)/($ty1-$ty0+1)

$outline = [System.Drawing.Color]::FromArgb(255,46,30,22)
$dst = [System.Drawing.Bitmap]::new(96,96)
for($y=$ty0;$y -le $ty1;$y++){for($x=$tx0;$x -le $tx1;$x++){
  $g = $sheet.GetPixel($x+96,$y)
  if($g.A -eq 0){continue}
  $sx = [int][Math]::Min($src.Width-1, [Math]::Floor($sx0 + ($x-$tx0+0.5)*$scaleX))
  $sy = [int][Math]::Min($src.Height-1, [Math]::Floor($sy0 + ($y-$ty0+0.5)*$scaleY))
  $c = $src.GetPixel($sx,$sy)
  if(-not (isSubject $c)){ $c=$outline }
  # obrys tylko na krawędzi sylwetki: maska ma zabłąkane piksele obrysu w środku (np. 15,59)
  if($g.R -eq 210 -and $g.G -eq 21 -and $g.B -eq 37){
    foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1))){
      $nx=$x+$d[0]; $ny=$y+$d[1]
      if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96 -or $sheet.GetPixel($nx+96,$ny).A -eq 0){ $c=$outline; break }
    }
  }
  if($c.R + $c.G + $c.B -lt 30){ $c=$outline }
  # jasnoszara otoczka tła przy krawędzi
  $max=[Math]::Max($c.R,[Math]::Max($c.G,$c.B)); $min=[Math]::Min($c.R,[Math]::Min($c.G,$c.B))
  if($max -gt 150 -and $max-$min -lt 30){
    foreach($d in @(@(-1,0),@(1,0),@(0,-1),@(0,1))){
      $nx=$x+$d[0]; $ny=$y+$d[1]
      if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96){ $c=$outline; break }
      $n=$sheet.GetPixel($nx+96,$ny)
      if($n.A -eq 0 -or ($n.R -eq 210 -and $n.G -eq 21 -and $n.B -eq 37)){ $c=$outline; break }
    }
  }
  if($keepFace){
    $b = $sheet.GetPixel($x,$y+96)
    if($b.A -gt 0){ $c=$b }
  }
  $dst.SetPixel($x,$y,[System.Drawing.Color]::FromArgb(255,$c.R,$c.G,$c.B))
}}
$dst.Save((Join-Path $dir 'body-96.png'),[System.Drawing.Imaging.ImageFormat]::Png)

$big = [System.Drawing.Bitmap]::new(768,768)
$gr = [System.Drawing.Graphics]::FromImage($big)
$gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gr.DrawImage($dst,0,0,768,768)
$big.Save((Join-Path $dir 'body-8x.png'),[System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "source bbox $sx0,$sy0..$sx1,$sy1 -> target $tx0,$ty0..$tx1,$ty1 (scale $([Math]::Round($scaleX,2)) x $([Math]::Round($scaleY,2)))"
$gr.Dispose(); $big.Dispose(); $dst.Dispose(); $src.Dispose(); $sheet.Dispose()
