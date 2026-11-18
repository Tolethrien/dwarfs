param([string]$dir, [string]$filter = 'beard-*.png')
Add-Type -AssemblyName System.Drawing
if(-not $dir){ $dir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..' }
$finished = Join-Path $dir 'finished'
$body=[System.Drawing.Bitmap]::new((Join-Path $finished 'body.png'))
$beards=@(Get-ChildItem $finished -Filter $filter | ForEach-Object { ,@($_.BaseName, $_.Name) })
$rng=[System.Random]::new()
function hsv($h,$s,$v){ $c=$v*$s; $x=$c*(1-[Math]::Abs((($h/60)%2)-1)); $m=$v-$c
  $r,$g,$b = switch([int][Math]::Floor($h/60)%6){0{$c,$x,0}1{$x,$c,0}2{0,$c,$x}3{0,$x,$c}4{$x,0,$c}5{$c,0,$x}}
  @([int](($r+$m)*255),[int](($g+$m)*255),[int](($b+$m)*255)) }
$s=4; $cell=96*$s; $pad=10; $label=22
$out=[System.Drawing.Bitmap]::new($beards.Count*2*($cell+$pad)+$pad, $cell+$label+$pad*2)
$gr=[System.Drawing.Graphics]::FromImage($out); $gr.Clear([System.Drawing.Color]::FromArgb(255,40,40,48))
$gr.InterpolationMode='NearestNeighbor'; $gr.PixelOffsetMode='Half'
$font=[System.Drawing.Font]::new('Segoe UI',11)
$i=0
foreach($bd in $beards){
  $layer=[System.Drawing.Bitmap]::new((Join-Path $finished $bd[1]))
  for($k=0;$k -lt 2;$k++){
    $t=hsv ($rng.NextDouble()*360) (0.25+$rng.NextDouble()*0.6) (0.45+$rng.NextDouble()*0.5)
    $img=[System.Drawing.Bitmap]::new(96,96)
    for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
      $c=$body.GetPixel($x,$y); $l=$layer.GetPixel($x,$y)
      if($l.A -gt 0){ $v=$l.R/255; $c=[System.Drawing.Color]::FromArgb(255,[int]($t[0]*$v),[int]($t[1]*$v),[int]($t[2]*$v)) }
      if($c.A -gt 0){ $img.SetPixel($x,$y,$c) }
    }}
    $px=$pad+$i*($cell+$pad)
    $gr.DrawImage($img,$px,$pad+$label,$cell,$cell)
    $hex='#{0:X2}{1:X2}{2:X2}' -f $t[0],$t[1],$t[2]
    $gr.DrawString("$($bd[0])  $hex",$font,[System.Drawing.Brushes]::White,$px,4)
    $img.Dispose(); $i++
  }
  $layer.Dispose()
}
$out.Save((Join-Path $dir 'colors-preview.png'))
$gr.Dispose(); $out.Dispose(); $body.Dispose()
