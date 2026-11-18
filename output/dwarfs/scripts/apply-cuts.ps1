param([Parameter(Mandatory)][string]$marked, [string]$dir, [switch]$apply)
Add-Type -AssemblyName System.Drawing
if(-not $dir){ $dir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..' }
$sheetPath = Join-Path $dir 'dwarf-layers.png'
$json = Get-Content (Join-Path $dir 'dwarf-layers.json') -Raw | ConvertFrom-Json
$orig = [System.Drawing.Bitmap]::new($sheetPath)
$mark = [System.Drawing.Bitmap]::new((Resolve-Path $marked).Path)
if($orig.Width -ne $mark.Width -or $orig.Height -ne $mark.Height){ throw "rozmiar $($mark.Width)x$($mark.Height) inny niż spritesheet $($orig.Width)x$($orig.Height)" }
$cut = [System.Drawing.Color]::FromArgb(255,210,21,37)
$fill = [System.Drawing.Color]::FromArgb(255,55,210,21)
$guide = Join-Path $dir 'body-guide'
$neighbours = @(@(-1,0),@(1,0),@(0,-1),@(0,1),@(-1,-1),@(1,1),@(-1,1),@(1,-1))

foreach($row in @('body','armor','beard','tool','hand','gloves','helmet')){
  if(-not $json.$row){ continue }
  foreach($entry in $json.$row){
    $cx = $entry.crop.x; $cy = $entry.crop.y
    $layer = [System.Drawing.Bitmap]::new((Join-Path $dir "finished\$($entry.file)"))
    $toFill = New-Object System.Collections.Generic.List[int[]]
    $cutCount = 0; $other = 0
    for($y=0;$y -lt 96;$y++){for($x=0;$x -lt 96;$x++){
      $o = $orig.GetPixel($cx+$x,$cy+$y); $m = $mark.GetPixel($cx+$x,$cy+$y)
      if($o.ToArgb() -eq $m.ToArgb()){ continue }
      # czerwony albo wymazany gumką = wycięcie
      if($m.ToArgb() -eq $cut.ToArgb() -or $m.A -eq 0){ $layer.SetPixel($x,$y,[System.Drawing.Color]::Transparent); $cutCount++ }
      elseif($m.ToArgb() -eq $fill.ToArgb()){ $toFill.Add(@($x,$y)) }
      else { $other++ }
    }}
    if($cutCount -eq 0 -and $toFill.Count -eq 0 -and $other -eq 0){ $layer.Dispose(); continue }
    # wypełnianie od krawędzi do środka: piksel dostaje średnią z sąsiadów warstwy, którzy już mają kolor
    $pending = [System.Collections.Generic.List[int[]]]::new($toFill)
    while($pending.Count -gt 0){
      $done = @(); $next = New-Object System.Collections.Generic.List[int[]]
      foreach($p in $pending){
        $r=0;$g=0;$b=0;$n=0
        foreach($d in $neighbours){
          $nx=$p[0]+$d[0]; $ny=$p[1]+$d[1]
          if($nx -lt 0 -or $nx -ge 96 -or $ny -lt 0 -or $ny -ge 96){ continue }
          if(@($pending | Where-Object { $_[0] -eq $nx -and $_[1] -eq $ny }).Count -gt 0){ continue }
          $c=$layer.GetPixel($nx,$ny); if($c.A -eq 0){ continue }
          $r+=$c.R;$g+=$c.G;$b+=$c.B;$n++
        }
        if($n -gt 0){ $done += ,@($p[0],$p[1],[int]($r/$n),[int]($g/$n),[int]($b/$n)) } else { $next.Add($p) }
      }
      if($done.Count -eq 0){ Write-Output "  uwaga: $($next.Count) px do wypełnienia bez sąsiadów"; break }
      foreach($p in $done){ $layer.SetPixel($p[0],$p[1],[System.Drawing.Color]::FromArgb(255,$p[2],$p[3],$p[4])) }
      $pending = $next
    }
    Write-Output ("{0}: wycięte {1}, wypełnione {2}, inne zmiany (pominięte) {3}" -f $entry.file,$cutCount,$toFill.Count,$other)
    $target = Join-Path $guide ($entry.file -replace '\.png$','-cut.png')
    if($apply){ $target = Join-Path $dir "finished\$($entry.file)" }
    $copy = [System.Drawing.Bitmap]::new($layer); $layer.Dispose(); $copy.Save($target,[System.Drawing.Imaging.ImageFormat]::Png); $copy.Dispose()
  }
}
$orig.Dispose(); $mark.Dispose()
