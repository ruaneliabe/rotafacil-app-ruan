import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('[arranque] ' + path + ': updated');
  } else {
    console.log('[arranque] ' + path + ': no-op');
  }
};

patch('src/types.ts', (input) => {
  let s = input;
  const anchor = '  totalEarnedToday: number;';
  if (s.includes(anchor) && !s.includes('fixedFee?: number;')) {
    s = s.replace(anchor, `${anchor}\n  fixedFee?: number;\n  perDeliveryFee?: number;`);
  }
  return s;
});

patch('src/App.tsx', (input) => {
  let s = input;

  const oldCreation = `      deliveriesCountToday: 0,\n      totalEarnedToday: 0,\n      statsDate: today,\n      joinedQueueAt: Date.now(),`;
  const newCreation = `      deliveriesCountToday: 0,\n      fixedFee: Number((newMotoboyData as any).fixedFee || 0),\n      perDeliveryFee: Number((newMotoboyData as any).perDeliveryFee || 0),\n      totalEarnedToday: Number((newMotoboyData as any).fixedFee || 0),\n      statsDate: today,\n      joinedQueueAt: undefined,`;
  if (s.includes(oldCreation)) s = s.replace(oldCreation, newCreation);

  const oldDaily = `              totalEarnedToday: (isDifferentDay ? 0 : (driver.totalEarnedToday || 0)) + (newStatus === 'delivered' ? (target.deliveryFee || 0) : 0),`;
  const newDaily = `              totalEarnedToday: (isDifferentDay ? Number((driver as any).fixedFee || 0) : (driver.totalEarnedToday || 0)) + (newStatus === 'delivered' ? (Number((driver as any).perDeliveryFee || 0) || target.deliveryFee || 0) : 0),`;
  if (s.includes(oldDaily)) s = s.replace(oldDaily, newDaily);

  return s;
});

console.log('[arranque] fixed fee preserved in cadastro and daily total');
