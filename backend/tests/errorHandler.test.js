const { test } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../middleware/errorHandler");
test("parser errors never disclose or log submitted request bodies", t => {
  const log = t.mock.method(console, "error", () => {});
  const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
  handler({ status: 400, type: "entity.parse.failed", body: 'password-secret', message: 'password-secret' }, {}, res, () => {});
  assert.equal(res.code, 400); assert.equal(res.body.message, "Invalid JSON body");
  assert.equal(log.mock.callCount(), 0);
  handler({ status: 413, type: "entity.too.large", body: 'password-secret' }, {}, res, () => {});
  assert.equal(res.code, 413); assert.equal(res.body.message, "Request is too large");
  handler(new Error('password-secret'), {}, res, () => {});
  assert.equal(res.code, 500); assert.equal(res.body.message, "Internal server error");
  assert.equal(JSON.stringify(log.mock.calls).includes('password-secret'), false);
});
