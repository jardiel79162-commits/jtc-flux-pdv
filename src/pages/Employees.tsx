import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  cpf: string;
  role: "admin" | "gerente" | "caixa";
  created_at: string;
}

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [isViewPermissionsDialogOpen, setIsViewPermissionsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [newEmployeeId, setNewEmployeeId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<"info" | "permissions">("info");
  const [viewPermissions, setViewPermissions] = useState({
    can_access_pos: false,
    can_access_products: false,
    can_access_customers: false,
    can_view_subscription: false,
    can_edit_own_profile: false,
    can_access_settings: false,
  });
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    role: "caixa" as "gerente" | "caixa",
    password: "",
  });

  const [permissions, setPermissions] = useState({
    can_access_pos: true,
    can_access_products: false,
    can_access_customers: true,
    can_view_subscription: false,
    can_edit_own_profile: false,
    can_access_settings: false,
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar funcionários", variant: "destructive" });
    } else {
      setEmployees(data || []);
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      cpf: "",
      role: "caixa",
      password: "",
    });
    setPermissions({
      can_access_pos: true,
      can_access_products: false,
      can_access_customers: true,
      can_view_subscription: false,
      can_edit_own_profile: false,
      can_access_settings: false,
    });
    setEditingEmployee(null);
    setNewEmployeeId(null);
    setEditSection("info");
  };

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email || !formData.cpf) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    if (!editingEmployee && !formData.password) {
      toast({ title: "Senha é obrigatória para novos funcionários", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (editingEmployee) {
        // Atualizar funcionário existente
        const { error } = await supabase
          .from("employees")
          .update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            cpf: formData.cpf,
            role: formData.role,
          })
          .eq("id", editingEmployee.id);

        if (error) throw error;
        toast({ title: "Funcionário atualizado com sucesso!" });
      } else {
        // Chamar Edge Function para criar funcionário
        const { data: sessionData } = await supabase.auth.getSession();
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sessionData.session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              full_name: formData.full_name,
              cpf: formData.cpf,
              phone: formData.phone,
              role: formData.role,
              admin_id: user.id,
            }),
          }
        );

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar funcionário');
        }

        if (result.employee_id) {
          setNewEmployeeId(result.employee_id);
          setIsDialogOpen(false);
          setIsPermissionsDialogOpen(true);
        }
        return;
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      toast({ 
        title: "Erro ao salvar funcionário", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewPermissions = async (employee: Employee) => {
    setViewingEmployee(employee);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_permissions")
        .select("*")
        .eq("employee_id", employee.id)
        .single();

      if (error) throw error;

      if (data) {
        setViewPermissions({
          can_access_pos: data.can_access_pos,
          can_access_products: data.can_access_products,
          can_access_customers: data.can_access_customers,
          can_view_subscription: data.can_view_subscription,
          can_edit_own_profile: data.can_edit_own_profile,
          can_access_settings: data.can_access_settings,
        });
      }
      setIsViewPermissionsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar permissões",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeePermissions = async (employeeId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_permissions")
        .select("*")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPermissions({
          can_access_pos: data.can_access_pos,
          can_access_products: data.can_access_products,
          can_access_customers: data.can_access_customers,
          can_view_subscription: data.can_view_subscription,
          can_edit_own_profile: data.can_edit_own_profile,
          can_access_settings: data.can_access_settings,
        });
      } else {
        setPermissions({
          can_access_pos: true,
          can_access_products: false,
          can_access_customers: true,
          can_view_subscription: false,
          can_edit_own_profile: false,
          can_access_settings: false,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar permissões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone,
      cpf: employee.cpf,
      role: employee.role === "admin" ? "gerente" : employee.role,
      password: "",
    });
    setEditSection("info");
    loadEmployeePermissions(employee.id);
    setIsDialogOpen(true);
  };

  const handleUpdatePermissions = async () => {
    if (!editingEmployee) return;

    setLoading(true);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("employee_permissions")
        .select("id")
        .eq("employee_id", editingEmployee.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("employee_permissions")
          .update({
            ...permissions,
          })
          .eq("employee_id", editingEmployee.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("employee_permissions")
          .insert({
            employee_id: editingEmployee.id,
            ...permissions,
          });

        if (insertError) throw insertError;
      }

      toast({ title: "Permissões atualizadas com sucesso!" });
      setIsDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar permissões",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!newEmployeeId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("employee_permissions")
        .insert({
          employee_id: newEmployeeId,
          ...permissions,
        });

      if (error) throw error;

      toast({ title: "Funcionário cadastrado com sucesso!" });
      setIsPermissionsDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar permissões",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (employeeId: string, userId: string) => {
    setLoading(true);
    try {
      // Deletar funcionário (cascata vai deletar o user_role e permissões)
      const { error: deleteError } = await supabase
        .from("employees")
        .delete()
        .eq("id", employeeId);

      if (deleteError) throw deleteError;

      // Deletar usuário do auth
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      toast({ title: "Funcionário removido com sucesso!" });
      fetchEmployees();
    } catch (error: any) {
      toast({ 
        title: "Erro ao remover funcionário", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Funcionários</h1>
          <p className="text-muted-foreground">Gerencie os funcionários da sua loja</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? "Editar Funcionário" : "Novo Funcionário"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingEmployee && (
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/50 p-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    O que você deseja editar?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={editSection === "info" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditSection("info")}
                    >
                      Informações
                    </Button>
                    <Button
                      type="button"
                      variant={editSection === "permissions" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditSection("permissions")}
                    >
                      Permissões
                    </Button>
                  </div>
                </div>
              )}

              {(!editingEmployee || editSection === "info") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome Completo *</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      disabled={!!editingEmployee}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => {
                        // Formatar telefone automaticamente: (00) 00000-0000
                        let value = e.target.value.replace(/\D/g, "");
                        if (value.length > 11) value = value.slice(0, 11);
                        
                        let formatted = value;
                        if (value.length > 0) {
                          formatted = "(" + value;
                        }
                        if (value.length > 2) {
                          formatted = "(" + value.slice(0, 2) + ") " + value.slice(2);
                        }
                        if (value.length > 7) {
                          formatted = "(" + value.slice(0, 2) + ") " + value.slice(2, 7) + "-" + value.slice(7);
                        }
                        setFormData({ ...formData, phone: formatted });
                      }}
                      placeholder="(00) 00000-0000"
                      inputMode="numeric"
                      maxLength={15}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF *</Label>
                    <Input
                      value={formData.cpf}
                      onChange={(e) => {
                        // Formatar CPF automaticamente: 000.000.000-00
                        let value = e.target.value.replace(/\D/g, "");
                        if (value.length > 11) value = value.slice(0, 11);
                        
                        let formatted = value;
                        if (value.length > 3) {
                          formatted = value.slice(0, 3) + "." + value.slice(3);
                        }
                        if (value.length > 6) {
                          formatted = formatted.slice(0, 7) + "." + formatted.slice(7);
                        }
                        if (value.length > 9) {
                          formatted = formatted.slice(0, 11) + "-" + formatted.slice(11);
                        }
                        setFormData({ ...formData, cpf: formatted });
                      }}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      maxLength={14}
                      disabled={!!editingEmployee}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: "gerente" | "caixa") => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gerente">Gerente</SelectItem>
                        <SelectItem value="caixa">Funcionário do Caixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {!editingEmployee && (
                    <div className="space-y-2">
                      <Label>Senha *</Label>
                      <Input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Senha do funcionário"
                      />
                    </div>
                  )}
                  <Button onClick={handleSubmit} disabled={loading} className="w-full">
                    {loading
                      ? "Salvando..."
                      : editingEmployee
                        ? "Salvar informações"
                        : "Continuar"}
                  </Button>
                </div>
              )}

              {editingEmployee && editSection === "permissions" && (
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Pode realizar vendas (PDV)?</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite acesso ao sistema de ponto de venda
                        </p>
                      </div>
                      <Switch
                        checked={permissions.can_access_pos}
                        onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_pos: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Pode acessar produtos?</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite visualizar e gerenciar produtos
                        </p>
                      </div>
                      <Switch
                        checked={permissions.can_access_products}
                        onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_products: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Pode acessar clientes?</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite visualizar e gerenciar clientes
                        </p>
                      </div>
                      <Switch
                        checked={permissions.can_access_customers}
                        onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_customers: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Pode visualizar assinatura?</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite ver o status e detalhes da assinatura
                        </p>
                      </div>
                      <Switch
                        checked={permissions.can_view_subscription}
                        onCheckedChange={(checked) => setPermissions({ ...permissions, can_view_subscription: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Pode editar próprio perfil?</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite alterar nome e dados básicos
                        </p>
                      </div>
                      <Switch
                        checked={permissions.can_edit_own_profile}
                        onCheckedChange={(checked) => setPermissions({ ...permissions, can_edit_own_profile: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Pode acessar configurações? (não recomendado)</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite acesso às configurações da loja
                        </p>
                      </div>
                      <Switch
                        checked={permissions.can_access_settings}
                        onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_settings: checked })}
                      />
                    </div>
                  </div>

                  <Button onClick={handleUpdatePermissions} disabled={loading} className="w-full">
                    {loading ? "Salvando..." : "Salvar permissões"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewPermissionsDialogOpen} onOpenChange={setIsViewPermissionsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Permissões de {viewingEmployee?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label>Pode realizar vendas (PDV)</Label>
                    <p className="text-sm text-muted-foreground">
                      Acesso ao sistema de ponto de venda
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    viewPermissions.can_access_pos 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                      : 'bg-red-500/20 text-red-700 dark:text-red-400'
                  }`}>
                    {viewPermissions.can_access_pos ? 'Permitido' : 'Bloqueado'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label>Pode acessar produtos</Label>
                    <p className="text-sm text-muted-foreground">
                      Visualizar e gerenciar produtos
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    viewPermissions.can_access_products 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                      : 'bg-red-500/20 text-red-700 dark:text-red-400'
                  }`}>
                    {viewPermissions.can_access_products ? 'Permitido' : 'Bloqueado'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label>Pode acessar clientes</Label>
                    <p className="text-sm text-muted-foreground">
                      Visualizar e gerenciar clientes
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    viewPermissions.can_access_customers 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                      : 'bg-red-500/20 text-red-700 dark:text-red-400'
                  }`}>
                    {viewPermissions.can_access_customers ? 'Permitido' : 'Bloqueado'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label>Pode visualizar assinatura</Label>
                    <p className="text-sm text-muted-foreground">
                      Ver status e detalhes da assinatura
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    viewPermissions.can_view_subscription 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                      : 'bg-red-500/20 text-red-700 dark:text-red-400'
                  }`}>
                    {viewPermissions.can_view_subscription ? 'Permitido' : 'Bloqueado'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label>Pode editar próprio perfil</Label>
                    <p className="text-sm text-muted-foreground">
                      Alterar nome e dados básicos
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    viewPermissions.can_edit_own_profile 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                      : 'bg-red-500/20 text-red-700 dark:text-red-400'
                  }`}>
                    {viewPermissions.can_edit_own_profile ? 'Permitido' : 'Bloqueado'}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <Label>Pode acessar configurações</Label>
                    <p className="text-sm text-muted-foreground">
                      Acesso às configurações da loja
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    viewPermissions.can_access_settings 
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400' 
                      : 'bg-red-500/20 text-red-700 dark:text-red-400'
                  }`}>
                    {viewPermissions.can_access_settings ? 'Permitido' : 'Bloqueado'}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isPermissionsDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsPermissionsDialogOpen(false);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configurar Permissões do Funcionário</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pode realizar vendas (PDV)?</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite acesso ao sistema de ponto de venda
                    </p>
                  </div>
                  <Switch
                    checked={permissions.can_access_pos}
                    onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_pos: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pode acessar produtos?</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite visualizar e gerenciar produtos
                    </p>
                  </div>
                  <Switch
                    checked={permissions.can_access_products}
                    onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_products: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pode acessar clientes?</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite visualizar e gerenciar clientes
                    </p>
                  </div>
                  <Switch
                    checked={permissions.can_access_customers}
                    onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_customers: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pode visualizar assinatura?</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite ver o status e detalhes da assinatura
                    </p>
                  </div>
                  <Switch
                    checked={permissions.can_view_subscription}
                    onCheckedChange={(checked) => setPermissions({ ...permissions, can_view_subscription: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pode editar próprio perfil?</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite alterar nome e dados básicos
                    </p>
                  </div>
                  <Switch
                    checked={permissions.can_edit_own_profile}
                    onCheckedChange={(checked) => setPermissions({ ...permissions, can_edit_own_profile: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Pode acessar configurações? (não recomendado)</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite acesso às configurações da loja
                    </p>
                  </div>
                  <Switch
                    checked={permissions.can_access_settings}
                    onCheckedChange={(checked) => setPermissions({ ...permissions, can_access_settings: checked })}
                  />
                </div>
              </div>

              <Button onClick={handleSavePermissions} disabled={loading} className="w-full">
                {loading ? "Salvando..." : "Confirmar Permissões"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {employees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhum funcionário cadastrado ainda.
                <br />
                Clique em "Novo Funcionário" para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          employees.map((employee) => (
            <Card key={employee.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{employee.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {employee.role === "gerente" ? "Gerente" : "Funcionário do Caixa"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleViewPermissions(employee)}
                      title="Ver permissões"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(employee)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover {employee.full_name}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(employee.id, employee.user_id)}
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">E-mail</p>
                    <p className="font-medium">{employee.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">CPF</p>
                    <p className="font-medium">{employee.cpf}</p>
                  </div>
                  {employee.phone && (
                    <div>
                      <p className="text-muted-foreground">Telefone</p>
                      <p className="font-medium">{employee.phone}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Cadastrado em</p>
                    <p className="font-medium">
                      {new Date(employee.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Employees;
