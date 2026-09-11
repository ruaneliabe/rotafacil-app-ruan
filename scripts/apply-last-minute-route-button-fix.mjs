import fs from 'node:fs';

const patch = (path, mutate) => {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('[route-button] ' + path + ': updated');
  } else {
    console.log('[route-button] ' + path + ': no-op');
  }
};

patch('src/components/OperationDispatchView.tsx', (input) => {
  let s = input;
  const oldClick = "onClick={() => setSelected(s.orderIds)}";
  const newClick = "onClick={() => { setSelected(s.orderIds); window.dispatchEvent(new CustomEvent('rotafacil:create-prepared-route', { detail: { suggestion: s } })); }}";
  if (s.includes(oldClick)) s = s.replaceAll(oldClick, newClick);
  return s;
});

patch('src/components/PredispatchRoutesPanel.tsx', (input) => {
  let s = input;
  if (s.includes("rotafacil:create-prepared-route")) return s;

  const anchor = "  const [selectedLoose, setSelectedLoose] = useState<string[]>([]);";
  if (!s.includes(anchor)) return s;

  const listener = `${anchor}\n\n  useEffect(() => {\n    const handleCreatePreparedRoute = (event) => {\n      const suggestion = event?.detail?.suggestion;\n      if (!suggestion || !Array.isArray(suggestion.orderIds)) return;\n      const orderIds = suggestion.orderIds.filter(Boolean);\n      if (!orderIds.length) return;\n      setPreparedRoutes((current) => {\n        const alreadyExists = current.some((route) => route.orderIds.length === orderIds.length && route.orderIds.every((id) => orderIds.includes(id)));\n        if (alreadyExists) return current;\n        return [...current, {\n          id: \`prepared_\${Date.now()}_\${suggestion.id || 'suggestion'}\`,\n          orderIds,\n          corridorName: suggestion.corridorName || 'Rota sugerida',\n          confidenceScore: Number(suggestion.confidenceScore) || 80,\n          createdAt: Date.now(),\n        }];\n      });\n      setSelectedLoose([]);\n      triggerActionToast(\`Rota montada com \${orderIds.length} pedido(s).\`);\n    };\n    window.addEventListener('rotafacil:create-prepared-route', handleCreatePreparedRoute);\n    return () => window.removeEventListener('rotafacil:create-prepared-route', handleCreatePreparedRoute);\n  }, [triggerActionToast]);`;

  return s.replace(anchor, listener);
});

console.log('[route-button] final route click bridge applied');
