# Playwright E2E - PWA + GPS

Este teste abre o Rota Fácil em viewport de celular, concede geolocalização ao PWA e altera o GPS de X para Y a cada 5 segundos.

## Instalação local

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## Pré-condição

Antes de rodar o teste, deixe um motoboy de teste chamado pela loja com pelo menos um pedido em `ready_at_counter`.

Por padrão o teste usa:

- usuário: `teste_lucas`
- senha: `Teste1234`

Use variáveis de ambiente para trocar sem salvar credenciais no fonte.

## Rodar

PowerShell:

```powershell
$env:E2E_BASE_URL="https://rotafacil-app-ruan.onrender.com"
$env:E2E_DRIVER_USER="teste_lucas"
$env:E2E_DRIVER_PASS="Teste1234"
$env:E2E_START_LAT="-26.9194"
$env:E2E_START_LNG="-49.0661"
$env:E2E_END_LAT="-26.9280"
$env:E2E_END_LNG="-49.1090"
$env:E2E_GPS_INTERVAL_MS="5000"
$env:E2E_GPS_DURATION_MS="60000"
npx playwright test tests/pwa-motoboy-full-flow.spec.ts --headed
```

Para acompanhar no inspector:

```powershell
npx playwright test tests/pwa-motoboy-full-flow.spec.ts --debug
```

## Fluxo validado

1. abre o PWA como um Pixel 7;
2. concede permissão de localização;
3. define GPS inicial X;
4. faz login real como entregador;
5. espera a rota liberada pela loja;
6. confirma retirada;
7. inicia rota;
8. move GPS X -> Y, atualizando a posição a cada 5 segundos;
9. clica `Cheguei`;
10. conclui a entrega;
11. continua por outras paradas, se existirem;
12. falha se encontrar erros críticos de quota, permissão ou React no console.

O intervalo e a duração são configuráveis. Ex.: duração de 5 minutos com update a cada 5s gera 61 posições aproximadamente ao longo do trajeto.
