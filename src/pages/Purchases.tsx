import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, ShoppingCart, Eye, Package, TrendingUp } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import SubscriptionBlocker from "@/components/SubscriptionBlocker";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
}

interface PurchaseItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

interface Purchase {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  items: PurchaseItem[];
}

const Purchases = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { isExpired, isTrial, loading } = useSubscription();

  const [form, setForm] = useState({
    supplier_id: "",
    notes: "",
  });

  const [cartItems, setCartItems] = useState<PurchaseItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemCost, setItemCost] = useState("");

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchProducts();
  }, []);

  if (!loading && isExpired) {
    return <SubscriptionBlocker isTrial={isTrial} />;
  }

  const fetchPurchases = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: purchasesData, error: purchasesError } = await supabase
      .from("purchases")
      .select(`
        *,
        suppliers (name)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (purchasesError) {
      toast({ title: "Erro ao carregar compras", variant: "destructive" });
      return;
    }

    // Fetch items for each purchase
    const purchasesWithItems: Purchase[] = [];
    for (const purchase of purchasesData || []) {
      const { data: itemsData } = await supabase
        .from("purchase_items")
        .select(`
          *,
          products (name)
        `)
        .eq("purchase_id", purchase.id);

      purchasesWithItems.push({
        id: purchase.id,
        supplier_id: purchase.supplier_id,
        supplier_name: (purchase as any).suppliers?.name || null,
        total_amount: purchase.total_amount,
        notes: purchase.notes,
        created_at: purchase.created_at,
        items: (itemsData || []).map((item: any) => ({
          product_id: item.product_id,
          product_name: item.products?.name || "Produto removido",
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        })),
      });
    }

    setPurchases(purchasesWithItems);
  };

  const fetchSuppliers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name");

    if (!error) {
      setSuppliers(data || []);
    }
  };

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, cost_price, stock_quantity")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name");

    if (!error) {
      setProducts(data || []);
    }
  };

  const addToCart = () => {
    if (!selectedProduct || !itemQuantity || !itemCost) {
      toast({ title: "Preencha todos os campos do item", variant: "destructive" });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingIndex = cartItems.findIndex(item => item.product_id === selectedProduct);
    
    if (existingIndex >= 0) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += parseInt(itemQuantity);
      updated[existingIndex].unit_cost = parseFloat(itemCost);
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        product_id: selectedProduct,
        product_name: product.name,
        quantity: parseInt(itemQuantity),
        unit_cost: parseFloat(itemCost),
      }]);
    }

    setSelectedProduct("");
    setItemQuantity("1");
    setItemCost("");
  };

  const removeFromCart = (productId: string) => {
    setCartItems(cartItems.filter(item => item.product_id !== productId));
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const handleSave = async () => {
    if (isSaving) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (cartItems.length === 0) {
      toast({ title: "Adicione pelo menos um produto", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      // Create purchase
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .insert([{
          user_id: user.id,
          supplier_id: form.supplier_id || null,
          total_amount: calculateTotal(),
          notes: form.notes || null,
        }])
        .select()
        .single();

      if (purchaseError) {
        toast({ title: "Erro ao registrar compra", variant: "destructive" });
        return;
      }

      // Create purchase items
      const itemsToInsert = cartItems.map(item => ({
        purchase_id: purchaseData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from("purchase_items")
        .insert(itemsToInsert);

      if (itemsError) {
        toast({ title: "Erro ao registrar itens da compra", variant: "destructive" });
        return;
      }

      // Update product stock and cost_price
      for (const item of cartItems) {
        const product = products.find(p => p.id === item.product_id);
        if (product) {
          await supabase
            .from("products")
            .update({
              stock_quantity: product.stock_quantity + item.quantity,
              cost_price: item.unit_cost,
            })
            .eq("id", item.product_id);
        }
      }

      toast({ title: "Compra registrada com sucesso" });
      fetchPurchases();
      fetchProducts();
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ supplier_id: "", notes: "" });
    setCartItems([]);
    setSelectedProduct("");
    setItemQuantity("1");
    setItemCost("");
    setIsDialogOpen(false);
  };

  const viewPurchase = (purchase: Purchase) => {
    setViewingPurchase(purchase);
    setIsViewDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateMargin = (price: number, cost: number) => {
    if (cost === 0) return 0;
    return ((price - cost) / cost) * 100;
  };

  // Products with margin info
  const productsWithMargin = products.map(p => ({
    ...p,
    margin: calculateMargin(p.price, p.cost_price || 0),
  }));

  const filteredPurchases = purchases.filter(p =>
    p.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 overflow-hidden">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Compras</h1>
          <p className="text-muted-foreground">Registre compras e controle custos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Compra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Compra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Adicionar Produto</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3 sm:col-span-1">
                    <Select value={selectedProduct} onValueChange={(v) => {
                      setSelectedProduct(v);
                      const product = products.find(p => p.id === v);
                      if (product?.cost_price) {
                        setItemCost(product.cost_price.toString());
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Qtd"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      min="1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Custo unit."
                      value={itemCost}
                      onChange={(e) => setItemCost(e.target.value)}
                      step="0.01"
                      min="0"
                    />
                    <Button type="button" size="icon" onClick={addToCart}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {cartItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cartItems.map((item) => (
                          <TableRow key={item.product_id}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.quantity * item.unit_cost)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.product_id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="text-right text-lg font-bold">
                  Total: {formatCurrency(calculateTotal())}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observações sobre a compra"
                />
              </div>

              <Button onClick={handleSave} className="w-full" disabled={isSaving || cartItems.length === 0}>
                {isSaving ? "Salvando..." : "Registrar Compra"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Margin Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Margem Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productsWithMargin.length > 0 
                ? (productsWithMargin.reduce((sum, p) => sum + p.margin, 0) / productsWithMargin.length).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total em Compras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(purchases.reduce((sum, p) => sum + p.total_amount, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Total de Compras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchases.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar compra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredPurchases.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Nenhuma compra encontrada</h3>
          <p className="text-muted-foreground">Comece registrando sua primeira compra.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Data</TableHead>
                <TableHead className="w-[30%]">Fornecedor</TableHead>
                <TableHead className="w-[25%] text-right">Total</TableHead>
                <TableHead className="w-[15%] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="truncate">{formatDate(purchase.created_at)}</TableCell>
                  <TableCell className="truncate">{purchase.supplier_name || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(purchase.total_amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => viewPurchase(purchase)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Purchase Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Compra</DialogTitle>
          </DialogHeader>
          {viewingPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p className="font-medium">{formatDate(viewingPurchase.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fornecedor:</span>
                  <p className="font-medium">{viewingPurchase.supplier_name || "-"}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPurchase.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.quantity * item.unit_cost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="text-right text-lg font-bold">
                Total: {formatCurrency(viewingPurchase.total_amount)}
              </div>

              {viewingPurchase.notes && (
                <div>
                  <span className="text-muted-foreground text-sm">Observações:</span>
                  <p className="text-sm">{viewingPurchase.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchases;
