param([string]$dir)
Add-Type -AssemblyName System.Drawing
if(-not $dir){ $dir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..' }
$finished = Join-Path $dir 'finished'
# rząd = przedrostek nazwy pliku (body.png, beard-*.png, armor-*.png…); nieznane przedrostki trafiają na koniec alfabetycznie
# kolejność rzędów = kolejność rysowania (pancerz pod brodą, narzędzie pod dłonią/rękawicami)
$order = @('body','armor','beard','tool','hand','gloves','helmet')

$groups = [ordered]@{}
foreach($file in Get-ChildItem $finished -Filter '*.png' | Sort-Object Name){
  $prefix = $file.BaseName.Split('-')[0]
  if(-not $groups.Contains($prefix)){ $groups[$prefix] = New-Object System.Collections.Generic.List[System.IO.FileInfo] }
  $groups[$prefix].Add($file)
}
$known = @($order | Where-Object { $groups.Contains($_) })
$unknown = @($groups.Keys | Where-Object { $order -notcontains $_ } | Sort-Object)
$rows = @($known) + @($unknown)
if($rows.Count -eq 0){ throw "brak plików w $finished" }

$cols = ($rows | ForEach-Object { $groups[$_].Count } | Measure-Object -Maximum).Maximum
$sheet = [System.Drawing.Bitmap]::new($cols*96, $rows.Count*96, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$json = [ordered]@{ image='dwarf-layers.png'; frameWidth=96; frameHeight=96; columns=$cols; rows=$rows.Count }
for($r=0;$r -lt $rows.Count;$r++){
  $entries = @()
  for($c=0;$c -lt $groups[$rows[$r]].Count;$c++){
    $file = $groups[$rows[$r]][$c]
    $img = [System.Drawing.Bitmap]::new($file.FullName)
    if($img.Width -ne 96 -or $img.Height -ne 96){ throw "$($file.Name) ma $($img.Width)x$($img.Height), oczekiwane 96x96" }
    # światło hełmu: największa zwarta plama bardzo jasnych, ciepłych pikseli (soczewka, płomień, klejnot);
    # rozsiane błyski złota czy kości to osobne małe plamy i nie przesuwają środka
    $bright = New-Object 'double[,]' 96,96
    for($y=0;$y -lt 96;$y++){ for($x=0;$x -lt 96;$x++){
      $p=$img.GetPixel($x,$y)
      if($p.A -eq 0){ continue }
      $sheet.SetPixel($c*96+$x,$r*96+$y,$p)
      $lum = 0.3*$p.R+0.59*$p.G+0.11*$p.B
      if($rows[$r] -eq 'helmet' -and $lum -gt 215 -and $p.R -ge $p.B+25){ $bright[$x,$y] = $lum }
    } }
    $img.Dispose()
    $entryName = 'base'
    if($file.BaseName -ne $rows[$r]){ $entryName = $file.BaseName.Substring($rows[$r].Length+1) }
    $entry = [ordered]@{ name=$entryName; file=$file.Name; crop=[ordered]@{ x=$c*96; y=$r*96; width=96; height=96 } }
    if($rows[$r] -eq 'helmet'){
      $best = $null; $bestWeight = 0
      $seen = New-Object 'bool[,]' 96,96
      for($y=0;$y -lt 96;$y++){ for($x=0;$x -lt 96;$x++){
        if($bright[$x,$y] -eq 0 -or $seen[$x,$y]){ continue }
        $queue = New-Object System.Collections.Generic.Queue[int[]]; $queue.Enqueue(@($x,$y)); $seen[$x,$y] = $true
        $weight=0; $sumX=0; $sumY=0
        while($queue.Count -gt 0){
          $q = $queue.Dequeue(); $w = $bright[$q[0],$q[1]]; $weight+=$w; $sumX+=$q[0]*$w; $sumY+=$q[1]*$w
          for($dy=-1;$dy -le 1;$dy++){ for($dx=-1;$dx -le 1;$dx++){
            $nx=$q[0]+$dx; $ny=$q[1]+$dy
            if($nx -ge 0 -and $nx -lt 96 -and $ny -ge 0 -and $ny -lt 96 -and -not $seen[$nx,$ny] -and $bright[$nx,$ny] -gt 0){ $seen[$nx,$ny] = $true; $queue.Enqueue(@($nx,$ny)) }
          } }
        }
        if($weight -gt $bestWeight){ $bestWeight = $weight; $best = @(($sumX/$weight), ($sumY/$weight)) }
      } }
      if(-not $best){ throw "$($file.Name): brak źródła światła (jasnych, ciepłych pikseli)" }
      $entry['light'] = [ordered]@{ x=[Math]::Round($best[0]); y=[Math]::Round($best[1]) }
    }
    $entries += $entry
  }
  $json[$rows[$r]] = $entries
}
$json['rendering'] = 'All cells share one 96x96 canvas: draw one cell per row at the same position, in row order (body, armor, beard, tool, hand, gloves, helmet). Hair layers (beard-*) are grayscale; tint by multiply. Beards include eyebrows. Armor is full color. Helmet entries have light: the light source center in cell pixels, computed from the image.'
$sheet.Save((Join-Path $dir 'dwarf-layers.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
$json | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $dir 'dwarf-layers.json')
foreach($row in $rows){ Write-Output ("{0}: {1}" -f $row, (($groups[$row] | ForEach-Object { $_.Name }) -join ', ')) }
