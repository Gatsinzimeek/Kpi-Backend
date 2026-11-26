export function paging(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}
export const paged = (rows, total, { page, limit }) => ({
  data: rows,
  meta: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) || 1 },
});
