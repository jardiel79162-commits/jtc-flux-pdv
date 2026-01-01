import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Users, 
  Lock, 
  Unlock, 
  Search, 
  LogOut, 
  UserCheck,
  CreditCard,
  RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ADMIN_EMAIL = "jtc.adm@gmail.com";

interface BlockedCpf {
  id: string;
  cpf: string;
  reason: string | null;
  blocked_at: string;
  notes: string | null;
}

interface PaidUser {
  id: string;
  full_name: string;
  email: string;
  cpf: string;
  subscription_plan: string | null;
  subscription_ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blockedCpfs, setBlockedCpfs] = useState<BlockedCpf[]>([]);
  const [paidUsers, setPaidUsers] = useState<PaidUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTermUsers, setSearchTermUsers] = useState("");
  const [unblockingCpf, setUnblockingCpf] = useState<string | null>(null);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [selectedCpf, setSelectedCpf] = useState<BlockedCpf | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta página",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsAdmin(true);
    setLoading(false);
    await Promise.all([fetchBlockedCpfs(), fetchPaidUsers()]);
  };

  const fetchBlockedCpfs = async () => {
    const { data, error } = await supabase
      .from("blocked_cpfs")
      .select("*")
      .order("blocked_at", { ascending: false });

    if (error) {
      console.error("Error fetching blocked CPFs:", error);
    } else {
      setBlockedCpfs(data || []);
    }
  };

  const fetchPaidUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, cpf, subscription_plan, subscription_ends_at, trial_ends_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
    } else {
      setPaidUsers(data || []);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchBlockedCpfs(), fetchPaidUsers()]);
    setRefreshing(false);
    toast({ title: "Dados atualizados!" });
  };

  const handleUnblockCpf = async () => {
    if (!selectedCpf) return;
    
    setUnblockingCpf(selectedCpf.id);
    
    const { error } = await supabase
      .from("blocked_cpfs")
      .delete()
      .eq("id", selectedCpf.id);

    if (error) {
      toast({
        title: "Erro ao reativar conta",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Conta Reativada",
        description: `O CPF ${formatCpf(selectedCpf.cpf)} foi reativado com sucesso.`,
      });
      await fetchBlockedCpfs();
    }

    setUnblockingCpf(null);
    setShowUnblockDialog(false);
    setSelectedCpf(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatCpf = (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
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

  const getSubscriptionStatus = (user: PaidUser) => {
    const now = new Date();
    const subEnd = user.subscription_ends_at ? new Date(user.subscription_ends_at) : null;
    const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;

    if (subEnd && subEnd > now) {
      return { label: "Ativo", variant: "default" as const };
    }
    if (trialEnd && trialEnd > now) {
      return { label: "Trial", variant: "secondary" as const };
    }
    return { label: "Expirado", variant: "destructive" as const };
  };

  const filteredBlockedCpfs = blockedCpfs.filter(
    (item) => item.cpf.includes(searchTerm.replace(/\D/g, ""))
  );

  const filteredUsers = paidUsers.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTermUsers.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTermUsers.toLowerCase()) ||
      user.cpf.includes(searchTermUsers.replace(/\D/g, ""))
  );

  const activeUsers = paidUsers.filter((u) => getSubscriptionStatus(u).label === "Ativo");
  const trialUsers = paidUsers.filter((u) => getSubscriptionStatus(u).label === "Trial");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Painel de Administração</h1>
              <p className="text-muted-foreground">JTC FluxPDV - Controle do Sistema</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{paidUsers.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CreditCard className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeUsers.length}</p>
                  <p className="text-sm text-muted-foreground">Assinaturas Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <UserCheck className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{trialUsers.length}</p>
                  <p className="text-sm text-muted-foreground">Em Trial</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <Lock className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{blockedCpfs.length}</p>
                  <p className="text-sm text-muted-foreground">Contas Canceladas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="blocked" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Contas Canceladas
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários do Sistema
                </CardTitle>
                <CardDescription>
                  Visualize todos os usuários cadastrados e seus status de assinatura.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email ou CPF..."
                      value={searchTermUsers}
                      onChange={(e) => setSearchTermUsers(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhum usuário encontrado</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expira em</TableHead>
                          <TableHead>Cadastro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => {
                          const status = getSubscriptionStatus(user);
                          const expiresAt = user.subscription_ends_at || user.trial_ends_at;
                          return (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.full_name}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell className="font-mono">{formatCpf(user.cpf)}</TableCell>
                              <TableCell>
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </TableCell>
                              <TableCell>
                                {expiresAt ? formatDate(expiresAt) : "-"}
                              </TableCell>
                              <TableCell>{formatDate(user.created_at)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blocked CPFs Tab */}
          <TabsContent value="blocked">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Contas Canceladas
                </CardTitle>
                <CardDescription>
                  Visualize as contas que foram canceladas pelos usuários. Você pode reativar a conta removendo o CPF da lista.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por CPF..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {filteredBlockedCpfs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Nenhuma conta cancelada encontrada</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CPF</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Data do Cancelamento</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBlockedCpfs.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{formatCpf(item.cpf)}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                {item.reason === "account_deleted" ? "Conta Excluída" : 
                                 item.reason || "Cancelamento"}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(item.blocked_at)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedCpf(item);
                                  setShowUnblockDialog(true);
                                }}
                                disabled={unblockingCpf === item.id}
                              >
                                <Unlock className="h-4 w-4 mr-1" />
                                Reativar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Reactivate Confirmation Dialog */}
      <AlertDialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar Conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reativar a conta do CPF <strong className="font-mono">{selectedCpf && formatCpf(selectedCpf.cpf)}</strong>?
              <br /><br />
              O usuário poderá criar uma nova conta com este CPF após a reativação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblockCpf}>
              <Unlock className="h-4 w-4 mr-2" />
              Sim, Reativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;
