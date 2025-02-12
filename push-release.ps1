$Manifest = Get-Content -Path "manifest.json" -Raw
$Package = Get-Content -Path "package.json" -Raw
$Regex = '\"version\":\s*\"[0-9].[0-9].[0-9]\"\,'
$NewVersionLine = "`"version`":  `"$($args[0])`","
Set-Content -Encoding UTF8 -Path "manifest.json" -Value "$($Manifest -replace $Regex, $NewVersionLine)"
Set-Content -Encoding UTF8 -Path "package.json" -Value "$($Package -replace $Regex, $NewVersionLine)"
Write-Output "$($Package -replace $Regex, $NewVersionLine)"
Write-Output "Version updated to $($args[0])"

npm run build
git add --all
git commit -m "Version $($args[0]) release"
git tag -a $($args[0]) -m "$($args[0])"
git push
git push origin $($args[0])