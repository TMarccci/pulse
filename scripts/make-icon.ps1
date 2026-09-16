param([string]$OutDir)
Add-Type -AssemblyName System.Drawing

function New-PulseBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = [Math]::Max(1, [int]($size * 0.06))
  $rectSize = $size - 2*$pad
  $radius = [Math]::Max(2, [int]($size * 0.22))
  $d = $radius * 2
  $x = $pad; $y = $pad; $w = $rectSize; $h = $rectSize
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,99,102,241))
  $g.FillPath($brush, $path)
  $brush.Dispose()

  $penW = [Math]::Max(1.0, $size*0.085)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penW)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  function PX([double]$fx) { return [single]($pad + $rectSize*$fx) }
  function PY([double]$fy) { return [single]($pad + $rectSize*$fy) }
  [System.Drawing.PointF[]]$points = @(
    (New-Object System.Drawing.PointF((PX 0.15),(PY 0.52))),
    (New-Object System.Drawing.PointF((PX 0.35),(PY 0.52))),
    (New-Object System.Drawing.PointF((PX 0.45),(PY 0.28))),
    (New-Object System.Drawing.PointF((PX 0.57),(PY 0.74))),
    (New-Object System.Drawing.PointF((PX 0.67),(PY 0.52))),
    (New-Object System.Drawing.PointF((PX 0.85),(PY 0.52)))
  )
  $g.DrawLines($pen, $points)
  $pen.Dispose(); $g.Dispose()
  return $bmp
}

function Get-PngBytes($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  # comma prevents PowerShell from enumerating the byte[] into the pipeline
  return ,$ms.ToArray()
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$sizes = @(16,32,48,64,128,256)
$pngs = @()
foreach ($s in $sizes) {
  $b = New-PulseBitmap $s
  $pngs += ,(Get-PngBytes $b)
  if ($s -eq 256) { $b.Save((Join-Path $OutDir 'pulse-256.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
  if ($s -eq 32)  { $b.Save((Join-Path $OutDir 'favicon-32.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
  $b.Dispose()
}

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + (16 * $sizes.Count)
for ($i=0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $data = $pngs[$i]
  $wb = if ($s -ge 256) { 0 } else { $s }
  $bw.Write([Byte]$wb); $bw.Write([Byte]$wb); $bw.Write([Byte]0); $bw.Write([Byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$data.Length); $bw.Write([UInt32]$offset)
  $offset += $data.Length
}
foreach ($data in $pngs) { $bw.Write($data) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $OutDir 'pulse.ico'), $ms.ToArray())
$bw.Dispose(); $ms.Dispose()
Write-Host ("ICO written: {0} ({1} bytes)" -f (Join-Path $OutDir 'pulse.ico'), (Get-Item (Join-Path $OutDir 'pulse.ico')).Length)
