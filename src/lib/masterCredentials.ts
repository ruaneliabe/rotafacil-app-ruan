// Credenciais do login "master" (acesso administrativo/dev, fora do fluxo
// normal da loja). Antes disso, o padrão fixo no código era "ruan" / "ruan123"
// — um valor previsível, publicado em texto puro dentro do JS do site.
//
// IMPORTANTE: como essa checagem continua acontecendo no navegador (não tem
// backend validando), qualquer valor aqui colocado ainda pode, em tese, ser
// encontrado por alguém que vasculhe o bundle publicado. Isso não é "seguro"
// no sentido criptográfico — é uma melhoria de "não deixar a porta com a
// senha óbvia escrita do lado de fora". A correção definitiva seria mover
// essa checagem para um endpoint no servidor (ver conversa sobre próximos
// passos).
//
// Para trocar sem precisar mexer no código: defina as variáveis de ambiente
// VITE_MASTER_USERNAME / VITE_MASTER_PASSWORD no Vercel (Settings → Environment
// Variables) e faça um novo deploy. Sem elas, usa os valores gerados abaixo.

export const DEFAULT_MASTER_USERNAME =
  (import.meta as any).env?.VITE_MASTER_USERNAME || 'master_5nfgxyjd';

export const DEFAULT_MASTER_PASSWORD =
  (import.meta as any).env?.VITE_MASTER_PASSWORD || 'SSXnpD7hQ%UQJnWRkQdN';
