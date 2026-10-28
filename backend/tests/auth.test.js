const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authenticate, authorize } = require("../middleware/auth");
const { login, register } = require("../controllers/authController");
const originalFind = User.findById;
const originalSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "test-secret-only";
after(() => {
  User.findById = originalFind;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});
function response() {
  return { headers: {}, set(key, value) { this.headers[key] = value; return this; }, statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}
const id = "507f1f77bcf86cd799439011";

test("missing, expired, future, malformed and wrong-algorithm tokens return 401", async () => {
  const tokens = [null, "garbage",
    jwt.sign({ userId: id }, "wrong-secret"),
    jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: -1 }),
    jwt.sign({ userId: id }, process.env.JWT_SECRET, { notBefore: "1h" }),
    jwt.sign({ userId: {} }, process.env.JWT_SECRET),
    jwt.sign({ userId: id }, process.env.JWT_SECRET, { algorithm: "HS384" })];
  for (const token of tokens) {
    const res = response();
    await authenticate({ headers: token ? { authorization: `Bearer ${token}` } : {} }, res,
      () => assert.fail("must reject token"));
    assert.equal(res.statusCode, 401);
  }
});
test("authorization uses the current database role, not token claims", async () => {
  User.findById = async () => ({ _id: id, isActive: true, role: "candidate" });
  const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: id, role: "admin" }, process.env.JWT_SECRET)}` } };
  let called = false;
  await authenticate(req, response(), () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.user.role, "candidate");
  const res = response();
  authorize("recruiter")(req, res, () => assert.fail("must reject role"));
  assert.equal(res.statusCode, 403);
});
test("inactive and deleted users cannot authenticate", async () => {
  for (const user of [null, { _id: id, isActive: false }]) {
    User.findById = async () => user;
    const res = response();
    await authenticate({ headers: { authorization: `Bearer ${jwt.sign({ userId: id }, process.env.JWT_SECRET)}` } },
      res, () => assert.fail("must reject unavailable user"));
    assert.equal(res.statusCode, 401);
  }
});
test("missing login/register bodies return validation errors", async () => {
  for (const handler of [login, register]) {
    const res = response();
    await handler({}, res);
    assert.equal(res.statusCode, 400);
  }
});
test("passwords exceeding bcrypt's 72-byte limit are rejected", async () => {
  const password = "é".repeat(37);
  const res = response();
  await register({ body: { firstName: "Test", lastName: "User", email: "test@example.com", password } }, res);
  assert.equal(res.statusCode, 400);
  const loginRes = response();
  await login({ body: { email: "test@example.com", password } }, loginRes);
  assert.equal(loginRes.statusCode, 401);
});
test("public registration cannot create administrators", async () => {
  const res = response();
  await register({ body: { firstName: "Test", lastName: "User", email: "test@example.com", password: "password123", role: "admin" } }, res);
  assert.equal(res.statusCode, 400);
});

test("successful registration normalizes email, hashes passwords, and returns a valid session", async (t) => {
  const { comparePassword } = require("../utils/password");
  let created;
  t.mock.method(User, "findOne", async (filter) => {
    assert.equal(filter.email, "test@example.com");
    return null;
  });
  t.mock.method(User, "create", async (data) => {
    created = data;
    return { ...data, _id: id };
  });
  const res = response();
  await register({ body: { firstName: " Test ", lastName: " User ", email: " TEST@EXAMPLE.COM ", password: "password123" } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(created.role, "candidate");
  assert.equal(created.firstName, "Test");
  assert.equal(await comparePassword("password123", created.password), true);
  assert.equal(res.body.user.password, undefined);
  const payload = jwt.verify(res.body.token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  assert.equal(payload.userId, id);
  assert.ok(payload.exp > payload.iat);
});
test("login validates the password and returns the current account role", async (t) => {
  const { hashPassword } = require("../utils/password");
  const password = await hashPassword("password123");
  t.mock.method(User, "findOne", (filter) => {
    assert.equal(filter.email, "test@example.com");
    return { select: async () => ({ _id: id, isActive: true, role: "recruiter", password }) };
  });
  for (const [entered, expected] of [["incorrect", 401], ["password123", 200]]) {
    const res = response();
    await login({ body: { email: " TEST@EXAMPLE.COM ", password: entered } }, res);
    assert.equal(res.statusCode, expected);
    if (expected === 200) {
      assert.equal(res.body.user.role, "recruiter");
      assert.equal(res.body.user.password, undefined);
    }
  }
});
test("concurrent duplicate registrations return 409 rather than 500", async (t) => {
  t.mock.method(User, "findOne", async () => null);
  t.mock.method(User, "create", async () => { throw Object.assign(new Error("duplicate"), { code: 11000 }); });
  const res = response();
  await register({ body: { firstName: "Test", lastName: "User", email: "test@example.com", password: "password123" } }, res);
  assert.equal(res.statusCode, 409);
});
test("protected API responses cannot be cached", async () => {
  const res = response();
  await authenticate({ headers: {} }, res, () => assert.fail("authentication required"));
  assert.equal(res.headers["Cache-Control"], "no-store");
});
