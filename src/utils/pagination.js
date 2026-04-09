function getPagination(page = 1, limit = 50) {
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(parseInt(limit) || 50, 100);
  const offset = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    offset
  };
}

function buildPaginationMeta(page, limit, totalItems) {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit
  };
}

module.exports = {
  getPagination,
  buildPaginationMeta
};
