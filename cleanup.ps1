# Rflix User Center - Cleanup Script
# Menghapus file-file yang tidak diperlukan

Write-Host "Memulai cleanup Rflix User Center..." -ForegroundColor Cyan
Write-Host ""

# Hapus test files
Write-Host "Menghapus test files..." -ForegroundColor Yellow
$testFiles = Get-ChildItem -Path "." -Filter "test_*.js"
if ($testFiles.Count -gt 0) {
    $testFiles | ForEach-Object {
        Write-Host "  Menghapus: $($_.Name)" -ForegroundColor Red
        Remove-Item $_.FullName -Force
    }
    Write-Host "  $($testFiles.Count) test files dihapus" -ForegroundColor Green
} else {
    Write-Host "  Tidak ada test files yang ditemukan" -ForegroundColor Gray
}
Write-Host ""

# Hapus debug files
Write-Host "Menghapus debug files..." -ForegroundColor Yellow
$debugFiles = @(
    "analyze_subscription_issues.js",
    "debug_circular_dependency.js",
    "debug_import_issue.js",
    "demo_subscription_dashboard.js"
)

foreach ($file in $debugFiles) {
    if (Test-Path $file) {
        Write-Host "  Menghapus: $file" -ForegroundColor Red
        Remove-Item $file -Force
    }
}
Write-Host "  Debug files dihapus" -ForegroundColor Green
Write-Host ""

# Hapus dokumentasi yang tidak diperlukan
Write-Host "Menghapus dokumentasi yang tidak diperlukan..." -ForegroundColor Yellow
$docFiles = @(
    "COUNTDOWN_SYSTEM_IMPLEMENTATION.md",
    "DEPLOYMENT_GUIDE_WEBSOCKET_FIX.md",
    "FINAL_CLEANUP_DOCUMENTATION.md",
    "INTEGRATION_RELIABILITY_IMPROVEMENTS.md",
    "SUBSCRIPTION_DASHBOARD_DOCUMENTATION.md",
    "SUBSCRIPTION_ROUTES_SUMMARY.md",
    "USAGE_LIMITS_DOCUMENTATION.md",
    "project_plan.md"
)

foreach ($file in $docFiles) {
    if (Test-Path $file) {
        Write-Host "  Menghapus: $file" -ForegroundColor Red
        Remove-Item $file -Force
    }
}
Write-Host "  Dokumentasi tidak diperlukan dihapus" -ForegroundColor Green
Write-Host ""

# Verifikasi file .md yang tersisa
Write-Host "File .md yang tersisa:" -ForegroundColor Cyan
$remainingMd = Get-ChildItem -Path "." -Filter "*.md" | Select-Object -ExpandProperty Name
foreach ($md in $remainingMd) {
    Write-Host "  $md" -ForegroundColor Green
}
Write-Host ""

Write-Host "Cleanup selesai!" -ForegroundColor Green
Write-Host ""
Write-Host "Ringkasan:" -ForegroundColor Cyan
Write-Host "  - Test files: Dihapus" -ForegroundColor Green
Write-Host "  - Debug files: Dihapus" -ForegroundColor Green
Write-Host "  - Dokumentasi tidak diperlukan: Dihapus" -ForegroundColor Green
Write-Host "  - File .md tersisa: $($remainingMd.Count)" -ForegroundColor Green
