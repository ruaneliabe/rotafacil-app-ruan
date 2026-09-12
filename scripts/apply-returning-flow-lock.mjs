import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

const target = `          if (remainingOrders.length === 0) {
            const today = getBrazilDateKey();
            const isDifferentDay = driver.statsDate !== today;
            const updatedDriver: Motoboy = {
              ...driver,
              status: 'returning_to_store',
              activeOrdersCount: 0,`;

const replacement = `          if (remainingOrders.length === 0) {
            const today = getBrazilDateKey();
            const isDifferentDay = driver.statsDate !== today;
            // A ultima entrega conclui a rota, mas NAO inicia o retorno automaticamente.
            // O motoboy precisa tocar em \"Estou retornando\" no PWA. Ate esse clique,
            // manter delivering + zero pedidos faz o MotoboyApp exibir o card \"Rota concluida\".
            const updatedDriver: Motoboy = {
              ...driver,
              status: 'delivering',
              activeOrdersCount: 0,`;

if (source.includes(target)) {
  source = source.replace(target, replacement);
} else if (!source.includes('A ultima entrega conclui a rota, mas NAO inicia o retorno automaticamente.')) {
  throw new Error('[returning-flow-lock] last-delivery transition block not found');
}

if (!source.includes("status: 'delivering',\n              activeOrdersCount: 0")) {
  throw new Error('[returning-flow-lock] final delivery still auto-enters returning state');
}

fs.writeFileSync(path, source);
console.log('[returning-flow-lock] final delivery waits for explicit Estou retornando action');
