import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Calendar, TrendingUp, Package, DollarSign, Download } from "lucide-react";
import { format } from "date-fns";

interface Sale {
  id: string;
  created_at: string;
  total_amount: number;
  discount: number;
  payment_method: string;
}

interface ProductSale {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

const Reports = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [productSales, setProductSales] = useState<ProductSale[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { toast } = useToast();

  useEffect(() => {
    fetchSalesData();
  }, [startDate, endDate]);

  const fetchSalesData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Buscar vendas do período
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`)
      .order("created_at", { ascending: false });

    if (salesError) {
      toast({ title: "Erro ao carregar vendas", variant: "destructive" });
    } else {
      setSales(salesData || []);
    }

    // Buscar produtos mais vendidos
    const { data: itemsData, error: itemsError } = await supabase
      .from("sale_items")
      .select(`
        quantity,
        unit_price,
        product_id,
        sale_id,
        sales!inner(user_id, created_at)
      `)
      .eq("sales.user_id", user.id)
      .gte("sales.created_at", `${startDate}T00:00:00`)
      .lte("sales.created_at", `${endDate}T23:59:59`);

    if (!itemsError && itemsData) {
      // Agrupar por produto
      const productMap = new Map<string, { quantity: number; revenue: number; name: string }>();

      for (const item of itemsData) {
        const { data: product } = await supabase
          .from("products")
          .select("name")
          .eq("id", item.product_id)
          .single();

        if (product) {
          const existing = productMap.get(item.product_id) || {
            quantity: 0,
            revenue: 0,
            name: product.name,
          };

          productMap.set(item.product_id, {
            quantity: existing.quantity + item.quantity,
            revenue: existing.revenue + item.quantity * item.unit_price,
            name: existing.name,
          });
        }
      }

      const productSalesArray = Array.from(productMap.values())
        .map((p) => ({
          product_name: p.name,
          total_quantity: p.quantity,
          total_revenue: p.revenue,
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity);

      setProductSales(productSalesArray);
    }
  };

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalDiscount = sales.reduce((sum, sale) => sum + (sale.discount || 0), 0);
  const totalTransactions = sales.length;

  const paymentMethodSummary = sales.reduce((acc, sale) => {
    acc[sale.payment_method] = (acc[sale.payment_method] || 0) + sale.total_amount;
    return acc;
  }, {} as Record<string, number>);

  const exportToCSV = () => {
    const headers = ["Data", "Valor Total", "Desconto", "Forma de Pagamento"];
    const rows = sales.map((sale) => [
      format(new Date(sale.created_at), "dd/MM/yyyy HH:mm"),
      sale.total_amount.toFixed(2),
      (sale.discount || 0).toFixed(2),
      sale.payment_method,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${startDate}-${endDate}.csv`;
    a.click();
    toast({ title: "Relatório exportado com sucesso" });
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

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Análise de vendas e desempenho</p>
        </div>
        <Button onClick={exportToCSV} size="sm">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="space-y-2 w-full sm:w-auto">
          <Label className="text-sm">Data Inicial</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        <div className="space-y-2 w-full sm:w-auto">
          <Label className="text-sm">Data Final</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        <Button onClick={fetchSalesData} size="sm" className="w-full sm:w-auto">
          <Calendar className="mr-2 h-4 w-4" />
          Filtrar
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Vendas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Descontos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">R$ {totalDiscount.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-lg md:text-2xl font-bold">
              R$ {totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(2) : "0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="sales" className="text-xs md:text-sm">Vendas</TabsTrigger>
          <TabsTrigger value="products" className="text-xs md:text-sm">Produtos</TabsTrigger>
          <TabsTrigger value="payment" className="text-xs md:text-sm">Pagamento</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg">Histórico de Vendas</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[25%]">Data</TableHead>
                    <TableHead className="text-xs w-[25%]">Valor</TableHead>
                    <TableHead className="text-xs w-[25%]">Desconto</TableHead>
                    <TableHead className="text-xs w-[25%]">Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                        Nenhuma venda registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-xs truncate">{format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell className="text-xs font-medium truncate">R$ {sale.total_amount.toFixed(2)}</TableCell>
                        <TableCell className="text-xs truncate">R$ {(sale.discount || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs capitalize truncate">{getPaymentMethodLabel(sale.payment_method)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg">Produtos Mais Vendidos</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[50%]">Produto</TableHead>
                    <TableHead className="text-xs w-[20%]">Qtd</TableHead>
                    <TableHead className="text-xs w-[30%]">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum produto vendido
                      </TableCell>
                    </TableRow>
                  ) : (
                    productSales.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs font-medium truncate">{product.product_name}</TableCell>
                        <TableCell className="text-xs">{product.total_quantity}</TableCell>
                        <TableCell className="text-xs truncate">R$ {product.total_revenue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg">Resumo por Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[60%]">Forma de Pagamento</TableHead>
                    <TableHead className="text-xs w-[40%]">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.keys(paymentMethodSummary).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-muted-foreground text-sm">
                        Nenhuma venda registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    Object.entries(paymentMethodSummary).map(([method, total]) => (
                      <TableRow key={method}>
                        <TableCell className="text-xs capitalize font-medium truncate">{getPaymentMethodLabel(method)}</TableCell>
                        <TableCell className="text-xs truncate">R$ {total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
