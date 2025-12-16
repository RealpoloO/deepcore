# Script pour télécharger les EVE Online Static Data Export (SDE)
# https://developers.eveonline.com/resource/resources

Write-Host "📦 Téléchargement des EVE Online SDE..." -ForegroundColor Green

$sdeUrl = "https://eve-static-data-export.s3-eu-west-1.amazonaws.com/tranquility/sde.zip"
$zipFile = "sde.zip"
$extractFolder = "eve-online-static-data-3133773-jsonl"

# Vérifier si le dossier existe déjà
if (Test-Path $extractFolder) {
    Write-Host "✅ SDE déjà présent dans $extractFolder" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous re-télécharger? (o/N)"
    if ($response -ne 'o' -and $response -ne 'O') {
        Write-Host "⏭ Téléchargement annulé" -ForegroundColor Cyan
        exit 0
    }
    Remove-Item -Recurse -Force $extractFolder
}

# Télécharger le fichier
Write-Host "⬇ Téléchargement de $sdeUrl..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $sdeUrl -OutFile $zipFile -UseBasicParsing
    Write-Host "✅ Téléchargement terminé" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du téléchargement: $_" -ForegroundColor Red
    exit 1
}

# Extraire le ZIP
Write-Host "📂 Extraction des fichiers..." -ForegroundColor Cyan
try {
    Expand-Archive -Path $zipFile -DestinationPath "." -Force
    Write-Host "✅ Extraction terminée" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de l'extraction: $_" -ForegroundColor Red
    exit 1
}

# Nettoyer le fichier ZIP
Remove-Item $zipFile
Write-Host "🧹 Fichier ZIP supprimé" -ForegroundColor Cyan

Write-Host "`n✅ SDE installé avec succès!" -ForegroundColor Green
Write-Host "📁 Dossier: $extractFolder" -ForegroundColor Cyan
