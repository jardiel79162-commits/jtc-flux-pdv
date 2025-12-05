import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";
import { X, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/useSubscription";
import SubscriptionBlocker from "@/components/SubscriptionBlocker";

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  product_name?: string;
}

interface Sale {
  id: string;
  created_at: string;
  total_amount: number;
  discount: number;
  payment_method: string;
  payment_status: string;
  customer_id: string | null;
  customer_name?: string;
  items: SaleItem[];
}

const SalesHistory = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();
  const { isActive, isExpired, isTrial, loading } = useSubscription();

  useEffect(() => {
    fetchSales();
  }, []);

  // Bloquear se assinatura expirada
  if (!loading && isExpired) {
    return <SubscriptionBlocker isTrial={isTrial} />;
  }

  const fetchSales = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: salesData, error } = await supabase
      .from("sales")
      .select(`
        *,
        customers (name)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar vendas", variant: "destructive" });
      return;
    }

    if (salesData) {
      const salesWithItems = await Promise.all(
        salesData.map(async (sale) => {
          const { data: items } = await supabase
            .from("sale_items")
            .select(`
              *,
              products (name)
            `)
            .eq("sale_id", sale.id);

          return {
            ...sale,
            customer_name: sale.customers?.name,
            items: items?.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              product_name: item.products?.name,
            })) || [],
          };
        })
      );

      setSales(salesWithItems);
    }
  };

  const handleCancelSale = async () => {
    if (!saleToCancel) return;

    const sale = sales.find(s => s.id === saleToCancel);
    if (!sale) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // 1. Reverter estoque dos produtos
      for (const item of sale.items) {
        const { data: product } = await supabase
          .from("products")
          .select("stock_quantity")
          .eq("id", item.product_id)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({ stock_quantity: product.stock_quantity + item.quantity })
            .eq("id", item.product_id);
        }
      }

      // 2. Se for fiado, reverter saldo do cliente
      if (sale.payment_method === "fiado" && sale.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("current_balance")
          .eq("id", sale.customer_id)
          .single();

        if (customer) {
          const newBalance = customer.current_balance + sale.total_amount;
          await supabase
            .from("customers")
            .update({ current_balance: newBalance })
            .eq("id", sale.customer_id);

          // Criar transação de estorno
          await supabase
            .from("customer_transactions")
            .insert({
              customer_id: sale.customer_id,
              user_id: user.id,
              type: "payment",
              amount: sale.total_amount,
              description: `Estorno - Venda cancelada`,
            });
        }
      }

      // 3. Deletar itens da venda
      await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", saleToCancel);

      // 4. Deletar a venda
      const { error } = await supabase
        .from("sales")
        .delete()
        .eq("id", saleToCancel);

      if (error) throw error;

      toast({ title: "Venda cancelada com sucesso!" });
      setSaleToCancel(null);
      fetchSales();
    } catch (error) {
      console.error("Erro ao cancelar venda:", error);
      toast({ 
        title: "Erro ao cancelar venda", 
        description: "Não foi possível cancelar a venda. Tente novamente.",
        variant: "destructive" 
      });
    }
  };

  const viewSaleDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDetails(true);
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      credit: "Crédito",
      debit: "Débito",
      pix: "PIX",
      cash: "Dinheiro",
      fiado: "Fiado",
      credito: "Crédito Cliente",
    };
    return methods[method] || method;
  };

  const filteredSales = sales.filter(sale => {
    const searchLower = searchTerm.toLowerCase();
    return (
      sale.customer_name?.toLowerCase().includes(searchLower) ||
      sale.payment_method.toLowerCase().includes(searchLower) ||
      format(new Date(sale.created_at), "dd/MM/yyyy").includes(searchLower)
    );
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-hidden">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Histórico de Vendas</h1>
        <p className="text-muted-foreground text-sm">Visualize e gerencie suas vendas</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por cliente, pagamento ou data..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Vendas Realizadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[20%]">Data</TableHead>
                <TableHead className="text-xs w-[18%]">Cliente</TableHead>
                <TableHead className="text-xs w-[15%]">Pagamento</TableHead>
                <TableHead className="text-xs w-[12%]">Status</TableHead>
                <TableHead className="text-xs text-right w-[15%]">Total</TableHead>
                <TableHead className="text-xs text-right w-[20%]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                    Nenhuma venda encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-xs truncate">
                      {format(new Date(sale.created_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell className="text-xs truncate">
                      {sale.customer_name || "Avulso"}
                    </TableCell>
                    <TableCell className="text-xs truncate">
                      {getPaymentMethodLabel(sale.payment_method)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        sale.payment_status === "paid" 
                          ? "bg-green-500/20 text-green-700 dark:text-green-300" 
                          : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
                      }`}>
                        {sale.payment_status === "paid" ? "Pago" : "Pend."}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium truncate">
                      {formatCurrency(sale.total_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => viewSaleDetails(sale)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSaleToCancel(sale.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Detalhes da Venda */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium text-sm">
                    {format(new Date(selectedSale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium text-sm">{selectedSale.customer_name || "Cliente Avulso"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pagamento</p>
                  <p className="font-medium text-sm">{getPaymentMethodLabel(selectedSale.payment_method)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium text-sm">{selectedSale.payment_status === "paid" ? "Pago" : "Pendente"}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm">Itens da Venda</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Produto</TableHead>
                        <TableHead className="text-xs text-center">Qtd</TableHead>
                        <TableHead className="text-xs text-right">Preço</TableHead>
                        <TableHead className="text-xs text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{item.product_name}</TableCell>
                          <TableCell className="text-xs text-center">{item.quantity}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(item.unit_price * item.quantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(selectedSale.total_amount + selectedSale.discount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Desconto:</span>
                  <span>{formatCurrency(selectedSale.discount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedSale.total_amount)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Cancelamento */}
      <AlertDialog open={!!saleToCancel} onOpenChange={() => setSaleToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Venda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta venda? Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Reverter o estoque dos produtos</li>
                <li>Reverter o saldo do cliente (se for fiado)</li>
                <li>Remover permanentemente o registro da venda</li>
              </ul>
              <p className="mt-2 font-semibold">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelSale} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalesHistory;
