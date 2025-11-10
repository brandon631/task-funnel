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

deploy-netlify:
	pnpm --filter admin build
	cmd /c "netlify deploy --prod --site 38991b3e-9547-4199-8302-8e9bfd6fb8b5 --dir apps/admin/dist"
