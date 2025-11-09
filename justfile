set windows-shell := ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]

setup:
	pnpm -w install

build:
	pnpm -r build

dev-admin:
	pnpm --filter admin dev

dev-lead:
	pnpm --filter lead dev

dev-crew:
	pnpm --filter crew dev

check:
	pnpm -r run build

e2e:
	Write-Output "placeholder e2e"
