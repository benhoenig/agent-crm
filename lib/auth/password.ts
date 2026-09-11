// Password hashing forced onto NATIVE scrypt (2026-08-26).
//
// THE BUG THIS FIXES: `@better-auth/utils/password` picks its implementation
// with the "node" export condition. Bundled for workerd that condition does
// not apply, so the deployed worker shipped the PURE-JS @noble scrypt — ~105 ms
// of main-thread JS per sign-in, against a 10 ms CPU ceiling on the Workers
// Free plan. Live sign-in returned 503 "Worker exceeded CPU time limit" for
// almost every attempt; the occasional one squeaked through, which is why it
// looked like a wrong password rather than a broken runtime.
//
// workerd's `nodejs_compat` DOES implement node:crypto scrypt natively (probed
// against local workerd before writing this), so pointing Better Auth at it
// keeps the work in native code instead of the JS thread.
//
// COMPATIBILITY IS EXACT, DELIBERATELY. Same N/r/p/dkLen, same NFKC
// normalization, same `salt:hexkey` layout as both upstream implementations —
// compare @better-auth/utils/dist/password.node.mjs. Existing hashes keep
// verifying, so nobody has to reset a password.
//
// The salt uses Web Crypto getRandomValues rather than node:crypto randomBytes:
// it is available in every runtime here, so one less thing depending on the
// compat layer.

import { scrypt } from "node:crypto";

const config = { N: 16384, r: 16, p: 1, dkLen: 64 } as const;

function generateKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      config.dkLen,
      {
        N: config.N,
        r: config.r,
        p: config.p,
        // scrypt refuses to allocate past maxmem; N*r*128 is the working set,
        // doubled the way upstream does it.
        maxmem: 128 * config.N * config.r * 2,
      },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password: string): Promise<string> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) throw new Error("Invalid password hash");
  const target = await generateKey(password, salt);
  return target.toString("hex") === key;
}
