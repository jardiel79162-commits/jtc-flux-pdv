import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/utils";
import { Eye, Search, Download, Ban, FileText, File } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSubscription } from "@/hooks/useSubscription";
import SubscriptionBlocker from "@/components/SubscriptionBlocker";
import jsPDF from "jspdf";

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  product_name?: string;
  cost_price?: number;
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
              products (name, cost_price)
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
              cost_price: item.products?.cost_price || 0,
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

      await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", saleToCancel);

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

  const calculateSaleMargin = (sale: Sale) => {
    const revenue = sale.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const cost = sale.items.reduce((sum, item) => sum + item.quantity * (item.cost_price || 0), 0);
    return revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
  };

  const calculateSaleProfit = (sale: Sale) => {
    const revenue = sale.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const cost = sale.items.reduce((sum, item) => sum + item.quantity * (item.cost_price || 0), 0);
    return revenue - cost;
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

  const downloadAsTXT = (sale: Sale) => {
    let content = `========================================\n`;
    content += `           COMPROVANTE DE VENDA\n`;
    content += `========================================\n\n`;
    content += `Data: ${format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}\n`;
    content += `Cliente: ${sale.customer_name || "Cliente Avulso"}\n`;
    content += `Pagamento: ${getPaymentMethodLabel(sale.payment_method)}\n\n`;
    content += `----------------------------------------\n`;
    content += `ITENS\n`;
    content += `----------------------------------------\n`;
    
    sale.items.forEach(item => {
      content += `${item.product_name}\n`;
      content += `  ${item.quantity}x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.quantity * item.unit_price)}\n`;
    });
    
    content += `----------------------------------------\n`;
    content += `Subtotal: ${formatCurrency(sale.total_amount + sale.discount)}\n`;
    content += `Desconto: ${formatCurrency(sale.discount)}\n`;
    content += `Lucro: ${formatCurrency(calculateSaleProfit(sale))}\n`;
    content += `Margem: ${calculateSaleMargin(sale).toFixed(1)}%\n`;
    content += `========================================\n`;
    content += `TOTAL: ${formatCurrency(sale.total_amount)}\n`;
    content += `========================================\n`;
    content += `\nObrigado pela preferência!\n`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `venda-${format(new Date(sale.created_at), "dd-MM-yyyy-HHmm")}.txt`;
    a.click();
    toast({ title: "Comprovante baixado em TXT" });
  };

  const downloadAsPDF = (sale: Sale) => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("COMPROVANTE DE VENDA", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Data: ${format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 20, 35);
    doc.text(`Cliente: ${sale.customer_name || "Cliente Avulso"}`, 20, 42);
    doc.text(`Pagamento: ${getPaymentMethodLabel(sale.payment_method)}`, 20, 49);
    
    doc.line(20, 55, 190, 55);
    doc.text("ITENS", 20, 62);
    doc.line(20, 65, 190, 65);
    
    let y = 72;
    sale.items.forEach(item => {
      doc.text(`${item.product_name}`, 20, y);
      doc.text(`${item.quantity}x ${formatCurrency(item.unit_price)} = ${formatCurrency(item.quantity * item.unit_price)}`, 120, y);
      y += 7;
    });
    
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;
    
    doc.text(`Subtotal: ${formatCurrency(sale.total_amount + sale.discount)}`, 20, y);
    y += 7;
    doc.text(`Desconto: ${formatCurrency(sale.discount)}`, 20, y);
    y += 7;
    doc.text(`Lucro: ${formatCurrency(calculateSaleProfit(sale))}`, 20, y);
    y += 7;
    doc.text(`Margem: ${calculateSaleMargin(sale).toFixed(1)}%`, 20, y);
    y += 10;
    
    doc.setFontSize(14);
    doc.text(`TOTAL: ${formatCurrency(sale.total_amount)}`, 20, y);
    y += 15;
    
    doc.setFontSize(10);
    doc.text("Obrigado pela preferência!", 105, y, { align: "center" });
    
    doc.save(`venda-${format(new Date(sale.created_at), "dd-MM-yyyy-HHmm")}.pdf`);
    toast({ title: "Comprovante baixado em PDF" });
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
                <TableHead className="text-xs w-[40%]">Produto</TableHead>
                <TableHead className="text-xs w-[20%]">Data</TableHead>
                <TableHead className="text-xs text-right w-[40%]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-8">
                    Nenhuma venda encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-xs truncate">
                      {sale.items.length > 0 
                        ? sale.items.map(item => item.product_name).join(", ")
                        : "Sem produtos"}
                    </TableCell>
                    <TableCell className="text-xs truncate">
                      {format(new Date(sale.created_at), "dd/MM/yy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => viewSaleDetails(sale)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              title="Baixar comprovante"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => downloadAsTXT(sale)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Baixar TXT
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadAsPDF(sale)}>
                              <File className="h-4 w-4 mr-2" />
                              Baixar PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => setSaleToCancel(sale.id)}
                          title="Cancelar venda"
                        >
                          <Ban className="h-3 w-3" />
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
                  <p className="text-sm text-muted-foreground">Margem de Lucro</p>
                  <p className={`font-medium text-sm ${calculateSaleMargin(selectedSale) > 0 ? "text-green-600" : "text-red-500"}`}>
                    {calculateSaleMargin(selectedSale).toFixed(1)}%
                  </p>
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
                        <TableHead className="text-xs text-right">Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items.map((item, idx) => {
                        const itemRevenue = item.quantity * item.unit_price;
                        const itemCost = item.quantity * (item.cost_price || 0);
                        const itemMargin = itemRevenue > 0 ? ((itemRevenue - itemCost) / itemRevenue) * 100 : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{item.product_name}</TableCell>
                            <TableCell className="text-xs text-center">{item.quantity}</TableCell>
                            <TableCell className="text-xs text-right">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="text-xs text-right">
                              <span className={itemMargin > 0 ? "text-green-600" : "text-red-500"}>
                                {itemMargin.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lucro:</span>
                  <span className="text-green-600 font-medium">{formatCurrency(calculateSaleProfit(selectedSale))}</span>
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
            <AlertDialogCancel>Voltar</AlertDialogCancel>
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