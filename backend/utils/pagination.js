function pagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if ((query.page !== undefined && (typeof query.page !== "string" || !/^\d+$/.test(query.page))) ||
      (query.limit !== undefined && (typeof query.limit !== "string" || !/^\d+$/.test(query.limit))) ||
      !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      !Number.isSafeInteger((page - 1) * limit)) return null;
  return { page, limit };
}
module.exports = { pagination };
