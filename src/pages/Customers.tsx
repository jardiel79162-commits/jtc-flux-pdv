import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, DollarSign, CreditCard, ArrowUpCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import SubscriptionBlocker from "@/components/SubscriptionBlocker";

interface Customer {
  id: string;
  name: string;
  cpf: string;
  birth_date: string | null;
  address: string;
  phone: string | null;
  current_balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const { toast } = useToast();
  const { isActive, isExpired, isTrial, loading } = useSubscription();

  // Bloquear se assinatura expirada
  if (!loading && isExpired) {
    return <SubscriptionBlocker isTrial={isTrial} />;
  }

  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    birth_date: "",
    address: "",
    phone: "",
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchTransactions(selectedCustomer.id);
    }
  }, [selectedCustomer]);

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
      return;
    }

    setCustomers(data || []);
  };

  const fetchTransactions = async (customerId: string) => {
    const { data, error } = await supabase
      .from("customer_transactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar transações", variant: "destructive" });
      return;
    }

    setTransactions(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cpf || !formData.address) {
      toast({
        title: "Campos obrigatórios",
        description: "CPF e Endereço são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("customers").insert({
      user_id: user.id,
      name: formData.name,
      cpf: formData.cpf,
      birth_date: formData.birth_date || null,
      address: formData.address,
      phone: formData.phone || null,
    });

    if (error) {
      toast({ title: "Erro ao cadastrar cliente", variant: "destructive" });
      return;
    }

    toast({ title: "Cliente cadastrado com sucesso!" });
    setIsAddDialogOpen(false);
    setFormData({ name: "", cpf: "", birth_date: "", address: "", phone: "" });
    fetchCustomers();
  };

  const handlePayment = async () => {
    if (!selectedCustomer || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const currentDebt = -selectedCustomer.current_balance;
    const excess = amount - currentDebt;

    if (excess > 0) {
      // Pagamento maior que a dívida
      const userChoice = confirm(
        `O pagamento de ${formatCurrency(amount)} excede a dívida de ${formatCurrency(currentDebt)} em ${formatCurrency(excess)}.\n\nDeseja deixar como crédito para o cliente?`
      );

      if (userChoice) {
        // Deixar como crédito
        const newBalance = excess;
        await supabase.from("customers").update({ current_balance: newBalance }).eq("id", selectedCustomer.id);
        await supabase.from("customer_transactions").insert({
          customer_id: selectedCustomer.id,
          user_id: user.id,
          type: "payment",
          amount: amount,
          description: `Pagamento de ${formatCurrency(amount)} (excesso de ${formatCurrency(excess)} convertido em crédito)`,
        });
      } else {
        // Devolver o excesso
        const newBalance = 0;
        await supabase.from("customers").update({ current_balance: newBalance }).eq("id", selectedCustomer.id);
        await supabase.from("customer_transactions").insert({
          customer_id: selectedCustomer.id,
          user_id: user.id,
          type: "payment",
          amount: currentDebt,
          description: `Pagamento de ${formatCurrency(currentDebt)} (devolver ${formatCurrency(excess)} ao cliente)`,
        });
      }
    } else {
      // Pagamento parcial ou total
      const newBalance = selectedCustomer.current_balance + amount;
      await supabase.from("customers").update({ current_balance: newBalance }).eq("id", selectedCustomer.id);
      await supabase.from("customer_transactions").insert({
        customer_id: selectedCustomer.id,
        user_id: user.id,
        type: "payment",
        amount: amount,
        description: `Pagamento de ${formatCurrency(amount)}`,
      });
    }

    toast({ title: "Pagamento registrado com sucesso!" });
    setPaymentAmount("");
    setIsPaymentDialogOpen(false);
    fetchCustomers();
    if (selectedCustomer) {
      const updated = customers.find(c => c.id === selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
    }
  };

  const handleCredit = async () => {
    if (!selectedCustomer || !creditAmount) return;

    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newBalance = selectedCustomer.current_balance + amount;
    await supabase.from("customers").update({ current_balance: newBalance }).eq("id", selectedCustomer.id);
    await supabase.from("customer_transactions").insert({
      customer_id: selectedCustomer.id,
      user_id: user.id,
      type: "credit",
      amount: amount,
      description: `Crédito deixado de ${formatCurrency(amount)}`,
    });

    toast({ title: "Crédito registrado com sucesso!" });
    setCreditAmount("");
    setIsCreditDialogOpen(false);
    fetchCustomers();
    if (selectedCustomer) {
      const updated = customers.find(c => c.id === selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Cadastrar Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Cliente</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="address">Endereço *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {selectedCustomer ? (
        <div className="space-y-6">
          <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
            ← Voltar para lista
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>{selectedCustomer.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">CPF</p>
                  <p className="font-medium">{selectedCustomer.cpf}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{selectedCustomer.phone || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="font-medium">{selectedCustomer.address}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Atual</p>
                    <p className={`text-2xl font-bold ${selectedCustomer.current_balance < 0 ? "text-destructive" : "text-green-600"}`}>
                      {selectedCustomer.current_balance < 0 ? `Devendo: ${formatCurrency(-selectedCustomer.current_balance)}` : `Crédito: ${formatCurrency(selectedCustomer.current_balance)}`}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1 gap-2">
                        <DollarSign className="w-4 h-4" />
                        Registrar Pagamento
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Registrar Pagamento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="payment">Valor do Pagamento</Label>
                          <Input
                            id="payment"
                            type="number"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <Button onClick={handlePayment} className="w-full">Confirmar Pagamento</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1 gap-2">
                        <CreditCard className="w-4 h-4" />
                        Deixar Crédito
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Registrar Crédito</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="credit">Valor do Crédito</Label>
                          <Input
                            id="credit"
                            type="number"
                            step="0.01"
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <Button onClick={handleCredit} className="w-full">Confirmar Crédito</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Histórico de Transações</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <p className="text-sm font-medium">
                          {t.type === "debt" && "Compra a prazo"}
                          {t.type === "payment" && "Pagamento"}
                          {t.type === "credit" && "Crédito deixado"}
                        </p>
                        {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <p className={`font-bold ${t.type === "debt" ? "text-destructive" : "text-green-600"}`}>
                        {t.type === "debt" ? "-" : "+"}{formatCurrency(t.amount)}
                      </p>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação registrada</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <Card
              key={customer.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedCustomer(customer)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {customer.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">CPF:</span> {customer.cpf}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Telefone:</span> {customer.phone || "—"}
                  </p>
                  <div className="pt-2 border-t">
                    <p className={`font-bold ${customer.current_balance < 0 ? "text-destructive" : "text-green-600"}`}>
                      {customer.current_balance < 0
                        ? `Devendo: ${formatCurrency(-customer.current_balance)}`
                        : customer.current_balance > 0
                        ? `Crédito: ${formatCurrency(customer.current_balance)}`
                        : "Sem pendências"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {customers.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum cliente cadastrado
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Customers;
