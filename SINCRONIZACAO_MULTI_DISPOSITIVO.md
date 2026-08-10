# Sincronização multi-dispositivo

Nesta versão, o Firestore é a fonte única de verdade para dados operacionais.

Sincronizados em tempo real entre PC, notebook e celular:
- pedidos
- status dos pedidos
- vínculo pedido/motoboy
- motoboys
- status dos motoboys
- localização GPS do motoboy
- configurações da loja / expediente

Continuam locais de propósito (por dispositivo):
- sessão de login
- preferência de som
- tela/aba atualmente aberta

Também são removidas automaticamente chaves antigas de versões que guardavam dados operacionais no localStorage. Isso evita que um computador mostre pedidos/motoboys antigos enquanto outro mostra o Firestore.

Para o teste correto, todos os dispositivos precisam abrir a mesma URL publicada e a versão mais recente do deploy.
