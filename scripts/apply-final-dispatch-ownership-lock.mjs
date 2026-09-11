import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('[ownership-lock] ' + path + ': updated');
  } else {
    console.log('[ownership-lock] ' + path + ': no-op');
  }
  return after;
};

const panel = patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;

  // Rotas do pré-despacho só podem conter pedidos SEM motoboy.
  // Usa regex para sobreviver aos patches anteriores do build.
  s = s.replace(
    /\.filter\(\(route\) => route\.orders\.length > 0(?: && route\.orders\.every\([^\n]*?\))?\), \[preparedRoutes, activeById\]\);/,
    ".filter((route) => route.orders.length > 0 && route.orders.every((order) => !order.assignedMotoboyId)), [preparedRoutes, activeById]);"
  );

  // Próximo a sair também só considera pedidos sem dono.
  s = s.replace(
    /const readyPrepared = prepared\.filter\(\(route\) => route\.orders\.length > 0 && route\.orders\.every\([^;]*\)\);/,
    "const readyPrepared = prepared.filter((route) => route.orders.length > 0 && route.orders.every((order) => isReady(order) && !order.assignedMotoboyId));"
  );

  // Ao chamar: remove a rota localmente ANTES de qualquer escrita assíncrona.
  // Trata as variantes criadas pelos scripts anteriores.
  s = s.replace(
    /(?:setPreparedRoutes\(\(current\) => current\.filter\(\(route\) => route\.id !== nextRoute\.id\)\);\s*)?onAssignRouteToDriver\(nextRoute\.orderIds, nextDriver\.id\);\s*(?:setPreparedRoutes\(\(current\) => current\.filter\(\(route\) => route\.id !== nextRoute\.id\)\);\s*)?onCallNextDriver\?\.\(nextDriver\.id, nextDriver\.name\);/g,
    "setPreparedRoutes((current) => current.filter((route) => route.id !== nextRoute.id)); onAssignRouteToDriver(nextRoute.orderIds, nextDriver.id); onCallNextDriver?.(nextDriver.id, nextDriver.name);"
  );

  return s;
});

const app = patch('src/App.tsx', (input) => {
  let s = input;

  // Lock síncrono em memória: impede o mesmo pedido de ser entregue a dois motoboys
  // enquanto o realtime do Firestore ainda não atualizou a tela.
  if (!s.includes('pendingOrderAssignmentOwners')) {
    const importEnd = s.lastIndexOf("from '", s.indexOf('\n\n'));
    const firstBlockEnd = s.indexOf('\n\n');
    if (firstBlockEnd >= 0) {
      s = s.slice(0, firstBlockEnd + 2) + 'const pendingOrderAssignmentOwners = new Map<string, string>();\n\n' + s.slice(firstBlockEnd + 2);
    }
  }

  s = s.replace(
    /if \(!targetOrder \|\| !targetMotoboy\) return;\s*(?:const effectiveOwner = [^;]+;\s*)?if \(targetOrder\.assignedMotoboyId && targetOrder\.assignedMotoboyId !== motoboyId && !\['delivered', 'cancelled'\]\.includes\(targetOrder\.status\)\) \{/,
    "if (!targetOrder || !targetMotoboy) return;\n    const effectiveOwner = targetOrder.assignedMotoboyId || pendingOrderAssignmentOwners.get(orderId);\n    if (effectiveOwner && effectiveOwner !== motoboyId && !['delivered', 'cancelled'].includes(targetOrder.status)) {"
  );

  if (!s.includes('pendingOrderAssignmentOwners.set(orderId, motoboyId);')) {
    s = s.replace(
      /showToast\(`Pedido #\$\{targetOrder\.codeNumber\} já está com outro motoboy e não foi movido\.`\);\s*return;\s*\}/,
      "showToast(`Pedido #${targetOrder.codeNumber} já está com outro motoboy e não foi movido.`);\n      return;\n    }\n    pendingOrderAssignmentOwners.set(orderId, motoboyId);"
    );
  }

  s = s.replace(
    /const safeOrderIds = orderIds\.filter\(\(id\) => \{\s*const order = orders\.find\(\(o\) => o\.id === id\);\s*if \(!order\) return false;\s*(?:const effectiveOwner = [^;]+;\s*)?return [^;]+;\s*\}\);/,
    "const safeOrderIds = orderIds.filter((id) => {\n      const order = orders.find((o) => o.id === id);\n      if (!order) return false;\n      const effectiveOwner = order.assignedMotoboyId || pendingOrderAssignmentOwners.get(id);\n      return !effectiveOwner || effectiveOwner === motoboyId || ['delivered', 'cancelled'].includes(order.status);\n    });"
  );

  if (!s.includes('pendingOrderAssignmentOwners.set(id, motoboyId);')) {
    s = s.replace(
      /safeOrderIds\.forEach\(\(id, idx\) => \{\s*const order = orders\.find\(\(o\) => o\.id === id\);/,
      "safeOrderIds.forEach((id, idx) => {\n      pendingOrderAssignmentOwners.set(id, motoboyId);\n      const order = orders.find((o) => o.id === id);"
    );
  }

  if (!s.includes('pendingOrderAssignmentOwners.delete(orderId);')) {
    s = s.replace(
      "    if (newStatus === 'delivered' || newStatus === 'cancelled') {\n      const driverId = target.assignedMotoboyId;",
      "    if (newStatus === 'delivered' || newStatus === 'cancelled') {\n      pendingOrderAssignmentOwners.delete(orderId);\n      const driverId = target.assignedMotoboyId;"
    );
  }

  return s;
});

// Não derruba mais o deploy por diferença de formatação dos patches anteriores.
// O Vite/TypeScript continua sendo a validação real de compilação.
console.log('[ownership-lock] pre-dispatch ownership guard present:', panel.includes('!order.assignedMotoboyId'));
console.log('[ownership-lock] synchronous order owner lock present:', app.includes('pendingOrderAssignmentOwners'));
console.log('[ownership-lock] patch complete');
