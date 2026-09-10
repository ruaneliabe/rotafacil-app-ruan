// Hashing de senha no client usando a Web Crypto API (disponível nativamente no
// navegador e no Node 20+, sem precisar instalar nenhuma dependência nova).
//
// Isso NÃO é uma autenticação "de verdade" (isso exigiria mover a checagem para
// o servidor / Firebase Auth), mas resolve o problema mais grave: hoje as senhas
// ficam salvas em texto puro em coleções do Firestore que são publicamente
// legíveis. Com isso, mesmo que alguém leia o banco, só vê um hash salgado.
//
// Mantém compatibilidade com contas antigas (que ainda têm a senha em texto
// puro): se não existir hash, cai para a comparação antiga e sinaliza que a
// conta deve ser migrada (needsUpgrade), o que é feito de forma automática e
// silenciosa no próximo login bem-sucedido.

const PBKDF2_ITERATIONS = 120_000;

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

function getSubtle(): SubtleCrypto {
  const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
  const subtle = g.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto (crypto.subtle) indisponível neste ambiente.');
  }
  return subtle;
}

function getRandomBytes(length: number): Uint8Array {
  const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
  if (g.crypto?.getRandomValues) {
    return g.crypto.getRandomValues(new Uint8Array(length));
  }
  // Fallback extremamente improvável de ser necessário (ambientes sem Web Crypto).
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

async function deriveHash(password: string, saltHex: string): Promise<string> {
  const subtle = getSubtle();
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToHex(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = bytesToHex(getRandomBytes(16));
  const hash = await deriveHash(password, salt);
  return { hash, salt };
}

export interface HashedCredentialRecord {
  passwordHash?: string;
  passwordSalt?: string;
  /** Campo legado, senha em texto puro (contas criadas antes da migração). */
  legacyPlainPassword?: string;
}

export interface CredentialCheckResult {
  valid: boolean;
  /** true quando a conta ainda está no formato antigo e deveria ser migrada. */
  needsUpgrade: boolean;
}

export async function verifyCredential(
  inputPassword: string,
  record: HashedCredentialRecord
): Promise<CredentialCheckResult> {
  if (record.passwordHash && record.passwordSalt) {
    try {
      const computed = await deriveHash(inputPassword, record.passwordSalt);
      return { valid: computed === record.passwordHash, needsUpgrade: false };
    } catch (err) {
      console.warn('Falha ao verificar hash de senha:', err);
      return { valid: false, needsUpgrade: false };
    }
  }
  if (record.legacyPlainPassword) {
    const valid = record.legacyPlainPassword === inputPassword;
    return { valid, needsUpgrade: valid };
  }
  return { valid: false, needsUpgrade: false };
}
