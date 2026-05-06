import React, { useState } from 'react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Building2, ClipboardList, ArrowLeft } from 'lucide-react';
import DealersAdminPage from './DealersAdminPage';
import DealerOrdersPage from './DealerOrdersPage';

/**
 * Standalone hub for dealer management, accessible from the landing page.
 * Replaces the former "Dealers" / "Dealer Orders" tabs inside the main AdminPanel,
 * so admins have a dedicated place to manage the dealer network.
 */
export default function DealersHub({ onBackToLanding }) {
  const [tab, setTab] = useState('dealers');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 pt-4 max-w-7xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToLanding}
          className="gap-2 text-muted-foreground hover:text-foreground"
          data-testid="dealers-hub-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к выбору
        </Button>
      </div>

      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-orange-500" />
            Дилерская сеть
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление дилерами, их ценами и заказами, поступившими через дилерский портал.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="dealers" className="gap-2" data-testid="hub-tab-dealers">
              <Building2 className="h-4 w-4" />
              Дилеры
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2" data-testid="hub-tab-orders">
              <ClipboardList className="h-4 w-4" />
              Заказы дилеров
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dealers">
            <DealersAdminPage />
          </TabsContent>

          <TabsContent value="orders">
            <DealerOrdersPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
