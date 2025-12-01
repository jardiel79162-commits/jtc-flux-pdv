import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Minus, Trash2, CreditCard, DollarSign, Smartphone, Banknote, ShoppingCart, ArrowRight, Download, FileText, X, User } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/useSubscription";
import SubscriptionBlocker from "@/components/SubscriptionBlocker";

interface Product {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  stock_quantity: number;
  internal_code: string | null;
  barcode: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface SaleData {
  id: string;
  total_amount: number;
  discount: number;
  payment_method: string;
  created_at: string;
  customer_name?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface Customer {
  id: string;
  name: string;
  cpf: string;
  current_balance: number;
}

const POS = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerBrowser, setShowCustomerBrowser] = useState(false);
  const [currentStep, setCurrentStep] = useState<"cart" | "payment" | "receipt">("cart");
  const [saleData, setSaleData] = useState<SaleData | null>(null);
  const [showFullscreenBrowser, setShowFullscreenBrowser] = useState(false);
  const [storeName, setStoreName] = useState("Loja");
  const { toast } = useToast();
  const { isActive, isExpired, isTrial, loading } = useSubscription();

  useEffect(() => {
    fetchProducts();
    fetchStoreName();
    fetchCustomers();
  }, []);

  // Bloquear se assinatura expirada
  if (!loading && isExpired) {
    return <SubscriptionBlocker isTrial={isTrial} />;
  }

  const fetchStoreName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("user_id", user.id)
      .single();

    if (data?.store_name) {
      setStoreName(data.store_name);
    }
  };

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gt("stock_quantity", 0);

    if (error) {
      toast({ title: "Erro ao carregar produtos", variant: "destructive" });
    } else {
      setProducts(data || []);
    }
  };

  const fetchCustomers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      toast({ title: "Erro ao carregar clientes", variant: "destructive" });
    } else {
      setCustomers(data || []);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        toast({ title: "Estoque insuficiente", variant: "destructive" });
        return;
      }
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    setSearchTerm("");
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return item;
        if (newQuantity > item.product.stock_quantity) {
          toast({ title: "Estoque insuficiente", variant: "destructive" });
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const getItemPrice = (item: CartItem) => {
    const price = item.product.promotional_price || item.product.price;
    return price * item.quantity;
  };

  const subtotal = cart.reduce((sum, item) => sum + getItemPrice(item), 0);
  const total = subtotal - discount;

  const goToPayment = () => {
    if (cart.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione produtos ao carrinho primeiro", variant: "destructive" });
      return;
    }
    setCurrentStep("payment");
  };

  const generateSaleId = (saleNumber: number) => {
    const firstLetter = storeName.charAt(0).toUpperCase();
    const lastLetter = storeName.charAt(storeName.length - 1).toUpperCase();
    const paddedNumber = String(saleNumber).padStart(6, '0');
    return `${firstLetter}${lastLetter}-${paddedNumber}`;
  };

  const finalizeSale = async () => {
    if (!paymentMethod) {
      toast({ title: "Selecione a forma de pagamento", variant: "destructive" });
      return;
    }

    if (paymentMethod === "fiado" && !selectedCustomer) {
      toast({ 
        title: "Cliente não selecionado", 
        description: "Por favor, selecione um cliente para venda a prazo",
        variant: "destructive" 
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obter o número da última venda para gerar o ID
      const { count } = await supabase
        .from("sales")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id);

      const saleNumber = (count || 0) + 1;
      const customSaleId = generateSaleId(saleNumber);

      // Criar venda
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert([{
          user_id: user.id,
          total_amount: total,
          discount: discount,
          payment_method: paymentMethod,
          customer_id: selectedCustomer?.id || null,
          payment_status: paymentMethod === "fiado" ? "pending" : "paid",
        }])
        .select()
        .single();

      if (saleError) {
        console.error("Erro ao criar venda:", saleError);
        toast({ 
          title: "Erro ao finalizar venda", 
          description: saleError.message,
          variant: "destructive" 
        });
        return;
      }

      // Criar itens da venda
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.promotional_price || item.product.price,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) {
        console.error("Erro ao criar itens:", itemsError);
        toast({ 
          title: "Erro ao registrar itens", 
          description: itemsError.message,
          variant: "destructive" 
        });
        return;
      }

      // Atualizar estoque
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from("products")
          .update({ stock_quantity: item.product.stock_quantity - item.quantity })
          .eq("id", item.product.id);

        if (stockError) {
          console.error("Erro ao atualizar estoque:", stockError);
        }
      }

      // Se for Fiado, atualizar saldo do cliente e criar transação
      if (paymentMethod === "fiado" && selectedCustomer) {
        const newBalance = selectedCustomer.current_balance - total;
        
        const { error: balanceError } = await supabase
          .from("customers")
          .update({ current_balance: newBalance })
          .eq("id", selectedCustomer.id);

        if (balanceError) {
          console.error("Erro ao atualizar saldo:", balanceError);
          toast({ 
            title: "Erro ao atualizar saldo do cliente", 
            description: balanceError.message,
            variant: "destructive" 
          });
          return;
        }

        const { error: transactionError } = await supabase
          .from("customer_transactions")
          .insert({
            customer_id: selectedCustomer.id,
            user_id: user.id,
            type: "debt",
            amount: total,
            description: `Compra - Venda ${customSaleId}`,
          });

        if (transactionError) {
          console.error("Erro ao criar transação:", transactionError);
          toast({ 
            title: "Erro ao registrar transação", 
            description: transactionError.message,
            variant: "destructive" 
          });
          return;
        }
      }

      // Preparar dados do comprovante
      setSaleData({
        id: customSaleId,
        total_amount: total,
        discount: discount,
        payment_method: paymentMethod,
        created_at: sale.created_at,
        customer_name: selectedCustomer?.name,
        items: cart.map(item => ({
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.product.promotional_price || item.product.price,
        })),
      });

      setCurrentStep("receipt");
      toast({ title: "Venda finalizada com sucesso!" });
    } catch (error) {
      console.error("Erro geral ao finalizar venda:", error);
      toast({ 
        title: "Erro ao finalizar venda", 
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive" 
      });
    }
  };

  const downloadReceipt = (format: "pdf" | "txt") => {
    if (!saleData) return;

    const content = generateReceiptContent(saleData);
    
    if (format === "txt") {
      const blob = new Blob([content], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprovante-${saleData.id}.txt`;
      a.click();
      toast({ title: "Comprovante TXT baixado!" });
    } else {
      // Para PDF, vamos criar um simples HTML e usar print
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Comprovante de Venda</title>
              <style>
                body { font-family: monospace; padding: 20px; }
                h1 { text-align: center; }
                .line { border-bottom: 1px dashed #000; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 5px; }
              </style>
            </head>
            <body>
              <pre>${content}</pre>
              <script>
                window.print();
                window.onafterprint = function() { window.close(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
      toast({ title: "Abrindo impressão de PDF..." });
    }
  };

  const generateReceiptContent = (sale: SaleData) => {
    let content = `
================================================
          JTC FLUXPDV - COMPROVANTE
================================================

Data: ${format(new Date(sale.created_at), "dd/MM/yyyy HH:mm")}
ID da Venda: ${sale.id}

------------------------------------------------
              ITENS VENDIDOS
------------------------------------------------

`;

    sale.items.forEach((item, index) => {
      content += `${index + 1}. ${item.product_name}\n`;
      content += `   Qtd: ${item.quantity} x R$ ${item.unit_price.toFixed(2)} = R$ ${(item.quantity * item.unit_price).toFixed(2)}\n\n`;
    });

    const subtotal = sale.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    content += `------------------------------------------------\n`;
    content += `Subtotal:              R$ ${subtotal.toFixed(2)}\n`;
    content += `Desconto:              R$ ${sale.discount.toFixed(2)}\n`;
    content += `TOTAL:                 R$ ${sale.total_amount.toFixed(2)}\n`;
    content += `------------------------------------------------\n`;
    content += `Forma de Pagamento: ${sale.payment_method.toUpperCase()}\n`;
    content += `================================================\n`;
    content += `       Obrigado pela preferência!\n`;
    content += `================================================\n`;

    return content;
  };

  const newSale = () => {
    setCart([]);
    setDiscount(0);
    setPaymentMethod("");
    setSelectedCustomer(null);
    setCurrentStep("cart");
    setSaleData(null);
    fetchProducts();
  };

  const paymentMethods = [
    { value: "credit", label: "Cartão de Crédito", icon: CreditCard },
    { value: "debit", label: "Cartão de Débito", icon: CreditCard },
    { value: "pix", label: "PIX", icon: Smartphone },
    { value: "cash", label: "Dinheiro", icon: Banknote },
    { value: "fiado", label: "Fiado", icon: User },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">PDV - Ponto de Venda</h1>
        <p className="text-muted-foreground">Sistema de vendas</p>
      </div>

      {/* Indicador de etapas */}
      <div className="flex items-center justify-center mb-8 gap-4">
        <div className={`flex items-center gap-2 ${currentStep === "cart" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "cart" ? "bg-primary text-white" : "bg-muted"}`}>
            1
          </div>
          <span>Carrinho</span>
        </div>
        <ArrowRight className="text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep === "payment" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "payment" ? "bg-primary text-white" : "bg-muted"}`}>
            2
          </div>
          <span>Pagamento</span>
        </div>
        <ArrowRight className="text-muted-foreground" />
        <div className={`flex items-center gap-2 ${currentStep === "receipt" ? "text-success font-semibold" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "receipt" ? "bg-success text-white" : "bg-muted"}`}>
            3
          </div>
          <span>Comprovante</span>
        </div>
      </div>

      {/* Etapa 1: Carrinho */}
      {currentStep === "cart" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto por nome, código interno ou código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFullscreenBrowser(true)}
              >
                Ver Produtos
              </Button>
            </div>

            {searchTerm && (
              <Card className="border-primary-light">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {filteredProducts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">Nenhum produto encontrado</p>
                    ) : (
                      filteredProducts.slice(0, 5).map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center justify-between p-3 hover:bg-accent-light rounded-lg cursor-pointer transition-colors"
                          onClick={() => addToCart(product)}
                        >
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Estoque: {product.stock_quantity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-accent">
                              R$ {(product.promotional_price || product.price).toFixed(2)}
                            </p>
                            {product.promotional_price && (
                              <p className="text-xs line-through text-muted-foreground">
                                R$ {product.price.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Carrinho de Compras
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-16 w-16 mx-auto mb-2 opacity-50" />
                    <p>Carrinho vazio</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.product.id}>
                          <TableCell className="font-medium">{item.product.name}</TableCell>
                          <TableCell>
                            R$ {(item.product.promotional_price || item.product.price).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.product.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.product.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">R$ {getItemPrice(item).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromCart(item.product.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    <Label>Desconto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex justify-between text-xl font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-accent">R$ {total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-accent-hover"
              onClick={goToPayment}
              disabled={cart.length === 0}
            >
              <ArrowRight className="mr-2 h-5 w-5" />
              Continuar para Pagamento
            </Button>
          </div>
        </div>
      )}

      {/* Etapa 2: Pagamento */}
      {currentStep === "payment" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo da Compra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <span>{item.product.name} x{item.quantity}</span>
                    <span>R$ {getItemPrice(item).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Desconto:</span>
                    <span className="text-accent">- R$ {discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total:</span>
                    <span className="text-accent">R$ {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <Button
                      key={method.value}
                      variant={paymentMethod === method.value ? "default" : "outline"}
                      className={`h-24 flex-col ${
                        paymentMethod === method.value
                          ? "bg-accent hover:bg-accent-hover border-2 border-accent"
                          : ""
                      }`}
                      onClick={() => {
                        setPaymentMethod(method.value);
                        if (method.value === "fiado") {
                          setShowCustomerBrowser(true);
                        }
                      }}
                    >
                      <Icon className="h-8 w-8 mb-2" />
                      <span className="text-sm">{method.label}</span>
                    </Button>
                  );
                })}
              </div>

              {paymentMethod === "fiado" && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  {selectedCustomer ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Cliente selecionado:</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{selectedCustomer.name}</p>
                          <p className="text-xs text-muted-foreground">CPF: {selectedCustomer.cpf}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCustomerBrowser(true)}
                        >
                          Trocar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <p className="text-sm text-destructive font-medium">Por favor, selecione um cliente.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCustomerBrowser(true)}
                      >
                        Selecionar Cliente
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dialog para seleção de clientes */}
          <Dialog open={showCustomerBrowser} onOpenChange={setShowCustomerBrowser}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Selecionar Cliente</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[60vh]">
                {customers.map((customer) => (
                  <Card
                    key={customer.id}
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${
                      selectedCustomer?.id === customer.id ? "border-2 border-accent" : ""
                    }`}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerBrowser(false);
                    }}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <User className="w-4 h-4" />
                        {customer.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">CPF:</span> {customer.cpf}
                        </p>
                        <p className={`font-semibold ${customer.current_balance < 0 ? "text-destructive" : "text-green-600"}`}>
                          {customer.current_balance < 0
                            ? `Devendo: R$ ${(-customer.current_balance).toFixed(2)}`
                            : customer.current_balance > 0
                            ? `Crédito: R$ ${customer.current_balance.toFixed(2)}`
                            : "Sem pendências"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {customers.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    Nenhum cliente cadastrado
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep("cart")}
            >
              Voltar
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-success to-accent hover:opacity-90"
              onClick={finalizeSale}
              disabled={!paymentMethod}
            >
              <DollarSign className="mr-2 h-5 w-5" />
              Finalizar Venda
            </Button>
          </div>
        </div>
      )}

      {/* Etapa 3: Comprovante */}
      {currentStep === "receipt" && saleData && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border-success">
            <CardHeader className="bg-success-light">
              <CardTitle className="flex items-center gap-2 text-success">
                <FileText className="h-6 w-6" />
                Venda Finalizada com Sucesso!
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">ID da Venda</p>
                  <p className="font-mono text-lg font-semibold">{saleData.id}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(saleData.created_at), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>

                <div className="border-t border-b py-4 space-y-2">
                  {saleData.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.product_name} x{item.quantity}</span>
                      <span>R$ {(item.quantity * item.unit_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Desconto:</span>
                    <span className="text-accent">- R$ {saleData.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total Pago:</span>
                    <span className="text-success">R$ {saleData.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Forma de Pagamento:</span>
                    <span className="capitalize font-medium">{saleData.payment_method}</span>
                  </div>
                  {saleData.customer_name && (
                    <div className="flex justify-between text-sm">
                      <span>Cliente:</span>
                      <span className="font-semibold">{saleData.customer_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Baixar Comprovante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escolha o formato para baixar o comprovante da venda:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col border-2 hover:border-primary hover:bg-primary-light"
                  onClick={() => downloadReceipt("pdf")}
                >
                  <Download className="h-6 w-6 mb-2" />
                  <span>Baixar PDF</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col border-2 hover:border-accent hover:bg-accent-light"
                  onClick={() => downloadReceipt("txt")}
                >
                  <FileText className="h-6 w-6 mb-2" />
                  <span>Baixar TXT</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-accent-hover"
            onClick={newSale}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Nova Venda
          </Button>
        </div>
      )}

      {/* Modal de Produtos em Tela Cheia */}
      <Dialog open={showFullscreenBrowser} onOpenChange={setShowFullscreenBrowser}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <div className="flex flex-col h-full">
            <DialogHeader className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl">
                    Produtos Disponíveis
                    {cart.length > 0 && (
                      <span className="ml-3 text-sm font-normal text-muted-foreground">
                        ({cart.length} {cart.length === 1 ? 'item' : 'itens'} no carrinho)
                      </span>
                    )}
                  </DialogTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFullscreenBrowser(false)}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12 text-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {(searchTerm ? filteredProducts : products).map((product) => {
                  const photoUrl = (product as any).photos?.[0];
                  const cartItem = cart.find(item => item.product.id === product.id);
                  const inCart = !!cartItem;
                  return (
                    <Card
                      key={product.id}
                      className={`hover:border-primary hover:shadow-lg transition-all group relative ${
                        inCart ? 'border-2 border-accent' : ''
                      }`}
                    >
                      <CardContent className="p-4 space-y-3">
                        {inCart && (
                          <div className="absolute top-2 right-2 bg-accent text-accent-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-lg z-10">
                            {cartItem?.quantity}
                          </div>
                        )}
                        {photoUrl ? (
                          <img 
                            src={photoUrl} 
                            alt={product.name}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary">
                          {product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Estoque: {product.stock_quantity}
                        </p>
                        <div className="space-y-1">
                          {product.promotional_price ? (
                            <>
                              <p className="text-xs line-through text-muted-foreground">
                                R$ {product.price.toFixed(2)}
                              </p>
                              <p className="text-lg font-bold text-accent">
                                R$ {product.promotional_price.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p className="text-lg font-bold text-accent">
                              R$ {product.price.toFixed(2)}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          {inCart && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(product.id, -1);
                                if (cartItem && cartItem.quantity === 1) {
                                  removeFromCart(product.id);
                                }
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            className={inCart ? "flex-1" : "w-full"}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {(searchTerm ? filteredProducts : products).length === 0 && (
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg text-muted-foreground">
                    {searchTerm ? "Nenhum produto encontrado" : "Nenhum produto disponível"}
                  </p>
                </div>
              )}
            </div>

            {/* Footer com botão Continuar */}
            <div className="border-t p-6 bg-card">
              <Button
                className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-accent-hover"
                onClick={() => setShowFullscreenBrowser(false)}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Continuar ({cart.length} {cart.length === 1 ? 'item' : 'itens'})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;
