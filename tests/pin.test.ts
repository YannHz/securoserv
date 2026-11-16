import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPin, verifyPin, validPin } from "../server/pin.ts";
test("PIN: longitud, cero inicial y formato", () => {
  for (const pin of [
    "1234567",
    "123456789",
    "01234567",
    "1234567a",
    12345678,
    null,
  ])
    assert.equal(validPin(pin), false);
  assert.equal(validPin("12345678"), true);
});
test("scrypt: compatible con la consulta SQL y rechaza un PIN diferente", async () => {
  const hash =
    "scrypt$16384$8$1$BwcHBwcHBwcHBwcHBwcHBw==$qgNOphlDk413BZHOFfzfZuqGRYouuzu8XbWL3dC6OWDRHL0KxN85k78yFTTNRqbPT93PRswqAcLJVX1ikTYiVA==";
  assert.equal(await verifyPin("45678912", hash), true);
  assert.equal(await verifyPin("99999999", hash), false);
  for (const bad of ["", hash.replace("16384", "999999999"), hash.slice(0, 50)])
    assert.equal(await verifyPin("45678912", bad), false);
});
test("scrypt: sal aleatoria por usuario y verificación del hash generado", async () => {
  const a = await hashPin("12345678"),
    b = await hashPin("12345678");
  assert.notEqual(a, b);
  assert.equal(await verifyPin("12345678", a), true);
});
