import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Route, User, Package } from 'lucide-react';
import { TRIP_STATUSES } from './constants';

const TripsList = ({
  trips,
  sectionKey,
  tripStatusFilter,
  setTripStatusFilter,
  selectedTrip,
  setSelectedTrip,
  onGoToOrders
}) => {
  const sectionTrips = trips.filter(t => t.section === sectionKey);
  const filteredTrips = sectionTrips.filter(t => (t.status || 'planned') === tripStatusFilter);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="h-4 w-4 text-purple-600" />
            Рейсы
          </CardTitle>
          <Badge variant="secondary" className="bg-purple-100 text-xs">
            {sectionTrips.length}
          </Badge>
        </div>
        
        {/* Status filter tabs */}
        <div className="flex gap-1 mt-2 flex-wrap">
          {Object.entries(TRIP_STATUSES).map(([statusKey, statusInfo]) => {
            const count = sectionTrips.filter(t => (t.status || 'planned') === statusKey).length;
            const StatusIcon = statusInfo.icon;
            return (
              <Button
                key={statusKey}
                size="sm"
                variant={tripStatusFilter === statusKey ? 'default' : 'outline'}
                onClick={() => setTripStatusFilter(statusKey)}
                className={`h-7 text-xs ${tripStatusFilter === statusKey ? '' : statusInfo.color}`}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {filteredTrips.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm mb-3">
              Нет рейсов в категории "{TRIP_STATUSES[tripStatusFilter]?.label}"
            </p>
            {tripStatusFilter === 'planned' && (
              <Button
                size="sm"
                variant="outline"
                onClick={onGoToOrders}
              >
                <Package className="h-3 w-3 mr-1" />
                Создать рейс
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredTrips.map((trip) => (
              <div
                key={trip.id}
                className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                  selectedTrip?.id === trip.id ? 'bg-purple-50 border-purple-300' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedTrip(trip)}
                data-testid={`trip-card-${trip.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{trip.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {trip.orderIds?.length || 0} заказов
                    </p>
                    {trip.driverName && (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3" />
                        {trip.driverName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TripsList;
