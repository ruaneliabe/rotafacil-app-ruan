# Ajustes para teste real - 10/08/2026

- Removido reset automático que apagava pedidos e motoboys do Firestore em dispositivo novo.
- Removido fallback de login que colocava usuário inválido no primeiro motoboy cadastrado.
- Removida senha universal `123` dos logins.
- Login da loja agora aceita apenas usuário `admin` + senha configurada da loja.
- Login do motoboy exige correspondência exata de usuário/nome/id + senha cadastrada.
- Removido login rápido que preenchia credenciais de motoboys na tela.
- GPS agora é enviado somente pelo dispositivo do motoboy autenticado e atualiza somente o próprio cadastro.
- Dados iniciais de pedidos e motoboys fictícios foram removidos do código.
- Cadastro de motoboy exige usuário e senha (mínimo 4 caracteres) e não injeta telefone/placa falsos.
- Telefone padrão da loja atualizado para (47) 99153-9855 em instalações novas.
- Senha inicial para banco totalmente novo: `hope2026`. Se o Firestore atual já possui uma senha configurada, ela continua valendo.

## Importante
As regras atuais do Firestore ainda não usam Firebase Authentication. O login do app melhora o fluxo e evita acessos acidentais pela interface, mas segurança real de produção exige Firebase Auth + regras vinculadas ao usuário/loja. Para o teste controlado de hoje, não alterei isso para não quebrar a aplicação.
