import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, X, Calendar, Filter, Waves, Flame } from 'lucide-react';

/**
 * Reusable filters component for orders
 */
export const OrderFilters = ({
  searchQuery,
  setSearchQuery,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  typeFilter,
  setTypeFilter,
  hasActiveFilters,
  onClearFilters,
  showTypeFilter = false,
  texts = {},
}) => {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  
  const defaultTexts = {
    ru: {
      searchPlaceholder: 'Поиск по номеру, имени или телефону...',
      dateFrom: 'Дата от',
      dateTo: 'Дата до',
      clearFilters: 'Сбросить',
      all: 'Все',
      balia: 'Купели',
      sauna: 'Сауны',
    },
    pl: {
      searchPlaceholder: 'Szukaj po numerze, nazwisku lub telefonie...',
      dateFrom: 'Data od',
      dateTo: 'Data do',
      clearFilters: 'Wyczyść',
      all: 'Wszystkie',
      balia: 'Balie',
      sauna: 'Sauny',
    },
  };
  
  const txt = { ...defaultTexts[lang], ...texts };

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* Type Filter (optional) */}
      {showTypeFilter && (
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="type-filter-select">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{txt.all}</SelectItem>
            <SelectItem value="balia">
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-blue-500" />
                {txt.balia}
              </div>
            </SelectItem>
            <SelectItem value="sauna">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                {txt.sauna}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      )}
      
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={txt.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
          data-testid="orders-search-input"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => setSearchQuery('')}
            data-testid="clear-search-btn"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Date Range Filters */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground dark:text-slate-300 hidden sm:block" />
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-36"
          title={txt.dateFrom}
          data-testid="date-from-input"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-36"
          title={txt.dateTo}
          data-testid="date-to-input"
        />
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="whitespace-nowrap"
            data-testid="clear-filters-btn"
          >
            <X className="h-4 w-4 mr-1" />
            {txt.clearFilters}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OrderFilters;
