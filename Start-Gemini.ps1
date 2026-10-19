$ErrorActionPreference = 'Stop'
$secureKey = Read-Host 'Dán Gemini API key (key không được lưu xuống đĩa)' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    Write-Host 'Đang giữ key trong bộ nhớ của phiên PowerShell này. Nhấn Ctrl+C để dừng server.'
    node (Join-Path $PSScriptRoot 'server.js')
}
finally {
    Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    $secureKey.Dispose()
}
