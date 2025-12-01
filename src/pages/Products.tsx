import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { useSubscription } from "@/hooks/useSubscription";
import SubscriptionBlocker from "@/components/SubscriptionBlocker";

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price: number | null;
  stock_quantity: number;
  min_stock_quantity: number | null;
  barcode: string | null;
  internal_code: string | null;
  is_active: boolean;
  category_id: string | null;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { toast } = useToast();
  const { isActive, isExpired, isTrial, loading } = useSubscription();

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    promotional_price: "",
    stock_quantity: "",
    min_stock_quantity: "",
    barcode: "",
    internal_code: "",
    category_id: "",
    is_active: true,
    photo_url: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    parent_id: "",
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Bloquear se assinatura expirada
  if (!loading && isExpired) {
    return <SubscriptionBlocker isTrial={isTrial} />;
  }

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar produtos", variant: "destructive" });
    } else {
      setProducts(data || []);
    }
  };

  const fetchCategories = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (error) {
      toast({ title: "Erro ao carregar categorias", variant: "destructive" });
    } else {
      setCategories(data || []);
    }
  };

  const handleSaveProduct = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const productData = {
      name: productForm.name,
      description: productForm.description || null,
      price: parseFloat(productForm.price),
      promotional_price: productForm.promotional_price ? parseFloat(productForm.promotional_price) : null,
      stock_quantity: parseInt(productForm.stock_quantity) || 0,
      min_stock_quantity: productForm.min_stock_quantity ? parseInt(productForm.min_stock_quantity) : null,
      barcode: productForm.barcode || null,
      internal_code: productForm.internal_code || null,
      photos: productForm.photo_url ? [productForm.photo_url] : null,
      category_id: productForm.category_id || null,
      is_active: productForm.is_active,
      user_id: user.id,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast({ title: "Erro ao atualizar produto", variant: "destructive" });
      } else {
        toast({ title: "Produto atualizado com sucesso" });
        fetchProducts();
        resetProductForm();
      }
    } else {
      const { error } = await supabase.from("products").insert([productData]);

      if (error) {
        toast({ title: "Erro ao criar produto", variant: "destructive" });
      } else {
        toast({ title: "Produto criado com sucesso" });
        fetchProducts();
        resetProductForm();
      }
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Verificar se o produto já possui vendas registradas
    const { data: relatedSales, error: salesError } = await supabase
      .from("sale_items")
      .select("id")
      .eq("product_id", id)
      .limit(1);

    if (salesError) {
      console.error("Erro ao verificar vendas relacionadas ao produto:", salesError);
      toast({
        title: "Erro ao verificar vendas do produto",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      return;
    }

    if (relatedSales && relatedSales.length > 0) {
      toast({
        title: "Produto com vendas registradas",
        description:
          "Não é possível excluir produtos que já foram vendidos. Marque-o como inativo em vez disso.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Erro ao deletar produto:", error);
      toast({
        title: "Erro ao deletar produto",
        description: "Não foi possível excluir o produto. Tente novamente.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Produto deletado com sucesso" });
      fetchProducts();
    }
  };

  const handleSaveCategory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const categoryData = {
      name: categoryForm.name,
      parent_id: categoryForm.parent_id || null,
      user_id: user.id,
    };

    if (editingCategory) {
      const { error } = await supabase
        .from("categories")
        .update(categoryData)
        .eq("id", editingCategory.id);

      if (error) {
        toast({ title: "Erro ao atualizar categoria", variant: "destructive" });
      } else {
        toast({ title: "Categoria atualizada com sucesso" });
        fetchCategories();
        resetCategoryForm();
      }
    } else {
      const { error } = await supabase.from("categories").insert([categoryData]);

      if (error) {
        toast({ title: "Erro ao criar categoria", variant: "destructive" });
      } else {
        toast({ title: "Categoria criada com sucesso" });
        fetchCategories();
        resetCategoryForm();
      }
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      toast({ title: "Erro ao deletar categoria", variant: "destructive" });
    } else {
      toast({ title: "Categoria deletada com sucesso" });
      fetchCategories();
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      price: "",
      promotional_price: "",
      stock_quantity: "",
      min_stock_quantity: "",
      barcode: "",
      internal_code: "",
      category_id: "",
      is_active: true,
      photo_url: "",
    });
    setEditingProduct(null);
    setIsProductDialogOpen(false);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: "", parent_id: "" });
    setEditingCategory(null);
    setIsCategoryDialogOpen(false);
  };

  const startEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      promotional_price: product.promotional_price?.toString() || "",
      stock_quantity: product.stock_quantity.toString(),
      min_stock_quantity: product.min_stock_quantity?.toString() || "",
      barcode: product.barcode || "",
      internal_code: product.internal_code || "",
      category_id: product.category_id || "",
      is_active: product.is_active,
      photo_url: (product as any).photos?.[0] || "",
    });
    setIsProductDialogOpen(true);
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      parent_id: category.parent_id || "",
    });
    setIsCategoryDialogOpen(true);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryName = (id: string | null) => {
    if (!id) return "-";
    return categories.find(c => c.id === id)?.name || "-";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seus produtos e categorias</p>
        </div>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código interno ou código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
              if (!open) resetProductForm();
              setIsProductDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetProductForm(); setIsProductDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={productForm.category_id}
                        onValueChange={(value) => setProductForm({ ...productForm, category_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.filter(c => !c.parent_id).map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Preço *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço Promocional</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={productForm.promotional_price}
                        onChange={(e) => setProductForm({ ...productForm, promotional_price: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Estoque Atual *</Label>
                      <Input
                        type="number"
                        value={productForm.stock_quantity}
                        onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estoque Mínimo</Label>
                      <Input
                        type="number"
                        value={productForm.min_stock_quantity}
                        onChange={(e) => setProductForm({ ...productForm, min_stock_quantity: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Código Interno</Label>
                      <Input
                        value={productForm.internal_code}
                        onChange={(e) => setProductForm({ ...productForm, internal_code: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Código de Barras</Label>
                      <Input
                        value={productForm.barcode}
                        onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                      />
                    </div>
                  </div>

                  <ImageUpload
                    bucket="product-photos"
                    currentImageUrl={productForm.photo_url}
                    onImageUploaded={(url) => setProductForm({ ...productForm, photo_url: url })}
                    label="Foto do Produto (opcional)"
                  />

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={productForm.is_active}
                      onCheckedChange={(checked) => setProductForm({ ...productForm, is_active: checked })}
                    />
                    <Label>Produto Ativo</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetProductForm}>Cancelar</Button>
                  <Button onClick={handleSaveProduct}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      Nenhum produto cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{getCategoryName(product.category_id)}</TableCell>
                      <TableCell>
                        {product.promotional_price ? (
                          <div>
                            <span className="line-through text-muted-foreground text-sm">
                              R$ {product.price.toFixed(2)}
                            </span>
                            <br />
                            <span className="text-accent font-semibold">
                              R$ {product.promotional_price.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          `R$ ${product.price.toFixed(2)}`
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.stock_quantity <= (product.min_stock_quantity || 0) ? "destructive" : "default"}>
                          {product.stock_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => startEditProduct(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetCategoryForm(); setIsCategoryDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Categoria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria Pai (Subcategoria)</Label>
                    <Select
                      value={categoryForm.parent_id}
                      onValueChange={(value) => setCategoryForm({ ...categoryForm, parent_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma (Categoria principal)" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.filter(c => !c.parent_id).map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetCategoryForm}>Cancelar</Button>
                  <Button onClick={handleSaveCategory}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Nenhuma categoria cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>
                        <Badge variant={category.parent_id ? "secondary" : "default"}>
                          {category.parent_id ? `Subcategoria de ${getCategoryName(category.parent_id)}` : "Categoria Principal"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => startEditCategory(category)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Products;
