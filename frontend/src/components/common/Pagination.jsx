import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";

function buildPages(currentPage, totalPages) {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}) {
  const { t } = useTranslation();
  const [searchPage, setSearchPage] = useState("");
  
  if (totalPages <= 1) return null;

  const pages = buildPages(currentPage, totalPages);

  const handlePageSearch = (e) => {
    e.preventDefault();
    const pageNum = parseInt(searchPage.trim(), 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setSearchPage("");
    }
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-black dark:text-white">
          {t("Page")} {currentPage} {t("of")} {totalPages}
        </div>
        <form onSubmit={handlePageSearch} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="number"
              min="1"
              max={totalPages}
              value={searchPage}
              onChange={(e) => setSearchPage(e.target.value)}
              placeholder={t("Go to page")}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base font-medium text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 w-32"
            />
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            type="submit"
            disabled={!searchPage || parseInt(searchPage) < 1 || parseInt(searchPage) > totalPages}
            className="btn-secondary px-4 py-2 !border font-medium disabled:cursor-not-allowed disabled:opacity-50"
            title={t("Jump to page")}
          >
            {t("Go")}
          </button>
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="btn-secondary px-3 py-2 !border disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("First page")}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn-secondary px-3 py-2 !border disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("Previous page")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={
              page === currentPage
                ? "btn-primary min-w-[44px] px-3 py-2 !border"
                : "btn-secondary min-w-[44px] px-3 py-2 !border"
            }
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn-secondary px-3 py-2 !border disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("Next page")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="btn-secondary px-3 py-2 !border disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("Last page")}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
