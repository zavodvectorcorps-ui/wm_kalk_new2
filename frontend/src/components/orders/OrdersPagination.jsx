import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable pagination component for orders
 */
export const OrdersPagination = ({
  currentPage,
  setCurrentPage,
  totalPages,
  startIndex,
  endIndex,
  totalCount,
  texts = {},
}) => {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  
  const defaultTexts = {
    ru: {
      page: 'Страница',
      of: 'из',
      showing: 'Показано',
      ordersCount: 'заказов',
    },
    pl: {
      page: 'Strona',
      of: 'z',
      showing: 'Pokazano',
      ordersCount: 'zamówień',
    },
  };
  
  const txt = { ...defaultTexts[lang], ...texts };
  
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 px-2" data-testid="orders-pagination">
      <div className="text-sm text-muted-foreground">
        {txt.showing} {startIndex + 1}-{Math.min(endIndex, totalCount)} {txt.of} {totalCount} {txt.ordersCount}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          data-testid="pagination-prev-btn"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-2">
          {txt.page} {currentPage} {txt.of} {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          data-testid="pagination-next-btn"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default OrdersPagination;
