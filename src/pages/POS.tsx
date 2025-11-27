import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Minus, Trash2, CreditCard, DollarSign, Smartphone, Banknote, ShoppingCart } from "lucide-react";

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

const POS = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

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

  const finalizeSale = async () => {
    if (cart.length === 0) {
      toast({ title: "Carrinho vazio", variant: "destructive" });
      return;
    }

    if (!paymentMethod) {
      toast({ title: "Selecione a forma de pagamento", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Criar venda
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert([{
        user_id: user.id,
        total_amount: total,
        discount: discount,
        payment_method: paymentMethod,
      }])
      .select()
      .single();

    if (saleError) {
      toast({ title: "Erro ao finalizar venda", variant: "destructive" });
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
      toast({ title: "Erro ao registrar itens", variant: "destructive" });
      return;
    }

    // Atualizar estoque
    for (const item of cart) {
      await supabase
        .from("products")
        .update({ stock_quantity: item.product.stock_quantity - item.quantity })
        .eq("id", item.product.id);
    }

    toast({ title: "Venda finalizada com sucesso!" });
    
    // Resetar carrinho
    setCart([]);
    setDiscount(0);
    setPaymentMethod("");
    fetchProducts();
  };

  const paymentMethods = [
    { value: "credit", label: "Cartão de Crédito", icon: CreditCard },
    { value: "debit", label: "Cartão de Débito", icon: CreditCard },
    { value: "pix", label: "PIX", icon: Smartphone },
    { value: "cash", label: "Dinheiro", icon: Banknote },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">PDV - Ponto de Venda</h1>
        <p className="text-muted-foreground">Sistema de vendas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Área de busca e produtos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto por nome, código interno ou código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {searchTerm && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {filteredProducts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Nenhum produto encontrado</p>
                  ) : (
                    filteredProducts.slice(0, 5).map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 hover:bg-accent rounded-lg cursor-pointer"
                        onClick={() => addToCart(product)}
                      >
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Estoque: {product.stock_quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
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

          {/* Carrinho */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
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
                        <TableCell>R$ {getItemPrice(item).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Resumo e pagamento */}
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
                  <span>R$ {total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <Button
                      key={method.value}
                      variant={paymentMethod === method.value ? "default" : "outline"}
                      className="h-20 flex-col"
                      onClick={() => setPaymentMethod(method.value)}
                    >
                      <Icon className="h-6 w-6 mb-2" />
                      <span className="text-xs">{method.label}</span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full h-14 text-lg"
            onClick={finalizeSale}
            disabled={cart.length === 0 || !paymentMethod}
          >
            <DollarSign className="mr-2 h-5 w-5" />
            Finalizar Venda
          </Button>
        </div>
      </div>
    </div>
  );
};

export default POS;
