# Revisão pré-loja — 10/08/2026

## Correções aplicadas nesta versão

- Link de rastreio inválido não abre mais o primeiro pedido do banco.
- Mapa do motoboy usa as configurações atuais da loja em vez de coordenadas fixas antigas.
- O mapa não inventa mais posição do motoboy quando ainda não recebeu GPS real.
- O traço da rota ativa passa a começar no GPS do motoboy quando disponível.
- Cadastro de pedido não salva mais coordenadas aleatórias/aproximadas quando geocodificação falha; agora bloqueia e pede correção do endereço.
- Telefone fictício automático de cliente removido.
- ETA do cliente deixou de ser um contador artificial e passa a usar distância GPS quando o pedido está em trânsito.
- Reordenar paradas não inicia/avança status da entrega automaticamente.
- Proteção contra clique/status duplicado em pedido entregue, evitando crédito duplicado ao motoboy.
- Código de rastreio ficou muito menos propenso a colisão.
- Contagem de pedidos ativos do motoboy é reconciliada com os pedidos reais da nuvem.
- Indicador de falta de internet adicionado.
- Logo movida para `public/` para funcionar no build de produção.
- `vite.config.ts` corrigido para ambiente ESM (`__dirname`).
- Coordenadas default da loja alinhadas entre os arquivos.
- Campos inexistentes `distanceKm` e `deliveryWindow` removidos do fluxo do motoboy; distância é calculada e horário usa `promisedTime`.
- Integrações falsas foram marcadas explicitamente como demonstração e a chave visual fake foi neutralizada.
- Timestamp `locationUpdatedAt` adicionado às atualizações GPS do motoboy.

## Bloqueadores de produção que NÃO foram reestruturados hoje

### 1. Firebase / autenticação
As regras atuais permitem leitura pública de `orders` e `motoboys`, e as credenciais de loja/motoboy ficam em documentos do Firestore. Para produção, migrar login para Firebase Authentication e separar dados públicos de rastreio dos dados administrativos.

### 2. GPS em segundo plano em PWA
`navigator.geolocation.watchPosition()` funciona bem enquanto a página/PWA está ativa, porém navegador móvel pode pausar/throttlar localização quando o app vai para segundo plano, principalmente ao abrir Waze/Google Maps ou bloquear a tela. Para rastreio contínuo real em background, usar shell nativo/Capacitor e plugin de background geolocation.

### 3. Mapa interno
O Leaflet mostra posição, paradas e ligação visual entre pontos, mas não calcula geometria viária/curvas de ruas. Waze/Google Maps continuam sendo a navegação real. Para rota interna por ruas, integrar serviço de routing (Google Directions/Routes, Mapbox, HERE, OSRM próprio etc.).

### 4. Multi-loja
Ainda não existe `storeId/tenantId` em pedidos, motoboys e turno. Antes de cadastrar uma segunda empresa no mesmo Firebase, implementar isolamento por loja.

### 5. Virada do dia
`createdAt` guarda horário, não data completa, e `deliveriesCountToday`/`totalEarnedToday` ficam persistidos. É necessário criar `createdAt` timestamp/ISO completo e rotina de turno/fechamento para zerar métricas do dia corretamente.

### 6. Numeração #101, #102...
O próximo número é calculado no cliente. Dois computadores criando pedido exatamente ao mesmo tempo ainda podem gerar o mesmo `codeNumber`. Para produção, criar contador transacional no Firestore.

## Teste obrigatório na Hope hoje

1. Publicar esta versão e abrir a MESMA URL no PC, notebook e celular.
2. Em todos os computadores, fazer hard refresh uma vez após o deploy.
3. Cadastrar um motoboy real com login e senha.
4. Entrar no celular do motoboy e permitir localização precisa.
5. Ver no painel da loja se o ponto do motoboy aparece na posição real.
6. Criar um pedido com endereço real conhecido.
7. Confirmar que o mesmo pedido aparece sem refresh em outro computador.
8. Vincular o pedido ao motoboy.
9. Confirmar no celular que ele recebe o pedido.
10. Marcar pronto/retirado/iniciar rota na ordem esperada.
11. Abrir o link de rastreio do cliente em outro celular/aba.
12. Caminhar/andar alguns metros com o celular do motoboy e verificar se o marcador muda no painel e no rastreio.
13. Testar link de rastreio alterando alguns caracteres: deve mostrar “pedido não encontrado”, nunca outro cliente.
14. Testar endereço escrito errado: o sistema deve bloquear em vez de posicionar em local aleatório.
15. Concluir entrega e verificar: pedido entregue, próxima parada liberada, saldo do motoboy incrementado uma vez.
16. Se houver segunda parada, reordenar antes da saída e confirmar que isso não inicia a entrega sozinho.
17. Desligar Wi‑Fi/dados por alguns segundos e verificar o aviso “SEM INTERNET”.
18. Reabrir a URL em outro dispositivo e conferir que pedidos/status continuam iguais.

## Observação de build

Foi possível rodar o `tsc` global para uma checagem parcial. Não apareceram erros locais adicionais depois das alterações quando filtrados os erros causados por dependências ausentes. O `npm ci` não pôde completar neste ambiente porque o registry interno utilizado aqui retorna 404 para `yargs-parser@21.1.1`; portanto o build Vite completo deve ser executado no seu ambiente/CI após baixar as dependências normalmente.
