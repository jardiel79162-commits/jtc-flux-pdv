import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserPermissions {
  isAdmin: boolean;
  isEmployee: boolean;
  can_access_dashboard: boolean;
  can_access_pos: boolean;
  can_access_products: boolean;
  can_access_customers: boolean;
  can_access_suppliers: boolean;
  can_access_history: boolean;
  can_access_mailbox: boolean;
  can_access_reports: boolean;
  can_view_subscription: boolean;
  can_edit_own_profile: boolean;
  can_access_settings: boolean;
  employeeId: string | null;
  adminId: string | null;
  employeeName: string | null;
}

export const useUserPermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    isAdmin: false,
    isEmployee: false,
    can_access_dashboard: true,
    can_access_pos: true,
    can_access_products: true,
    can_access_customers: true,
    can_access_suppliers: true,
    can_access_history: true,
    can_access_mailbox: true,
    can_access_reports: true,
    can_view_subscription: true,
    can_edit_own_profile: true,
    can_access_settings: true,
    employeeId: null,
    adminId: null,
    employeeName: null,
  });
  const [loading, setLoading] = useState(true);
  const [subscriptionActive, setSubscriptionActive] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar se é admin usando função has_role e dados de funcionário em paralelo
      const [{ data: isAdminResult }, employeeResponse] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.from("employees").select("id, admin_id, full_name").eq("user_id", user.id).maybeSingle(),
      ]);

      const isAdmin = !!isAdminResult;

      if (isAdmin) {
        // Admin tem todas as permissões
        setPermissions({
          isAdmin: true,
          isEmployee: false,
          can_access_dashboard: true,
          can_access_pos: true,
          can_access_products: true,
          can_access_customers: true,
          can_access_suppliers: true,
          can_access_history: true,
          can_access_mailbox: true,
          can_access_reports: true,
          can_view_subscription: true,
          can_edit_own_profile: true,
          can_access_settings: true,
          employeeId: null,
          adminId: user.id,
          employeeName: null,
        });
        setSubscriptionActive(true);
        setLoading(false);
        return;
      }

      const employee = employeeResponse.data;

      if (employee) {
        // Buscar permissões do funcionário e assinatura do admin em paralelo
        const [{ data: perms }, { data: adminProfile }] = await Promise.all([
          supabase
            .from("employee_permissions")
            .select("*")
            .eq("employee_id", employee.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("trial_ends_at, subscription_ends_at, subscription_plan")
            .eq("id", employee.admin_id)
            .single(),
        ]);

        // Verificar assinatura do admin (não do funcionário)
        let isActive = false;
        if (adminProfile) {
          const now = new Date();
          if (adminProfile.trial_ends_at && new Date(adminProfile.trial_ends_at) > now) {
            isActive = true;
          } else if (adminProfile.subscription_ends_at && new Date(adminProfile.subscription_ends_at) > now) {
            isActive = true;
          }
        }
        setSubscriptionActive(isActive);

        // Se não encontrou permissões, funcionário não tem acesso a nada
        setPermissions({
          isAdmin: false,
          isEmployee: true,
          can_access_dashboard: perms?.can_access_dashboard ?? true,
          can_access_pos: perms?.can_access_pos ?? false,
          can_access_products: perms?.can_access_products ?? false,
          can_access_customers: perms?.can_access_customers ?? false,
          can_access_suppliers: perms?.can_access_suppliers ?? false,
          can_access_history: perms?.can_access_history ?? false,
          can_access_mailbox: perms?.can_access_mailbox ?? false,
          can_access_reports: perms?.can_access_reports ?? false,
          can_view_subscription: perms?.can_view_subscription ?? false,
          can_edit_own_profile: perms?.can_edit_own_profile ?? false,
          can_access_settings: perms?.can_access_settings ?? false,
          employeeId: employee.id,
          adminId: employee.admin_id,
          employeeName: employee.full_name,
        });
      } else {
        // Usuário não é admin nem funcionário - sem permissões
        setPermissions({
          isAdmin: false,
          isEmployee: false,
          can_access_dashboard: false,
          can_access_pos: false,
          can_access_products: false,
          can_access_customers: false,
          can_access_suppliers: false,
          can_access_history: false,
          can_access_mailbox: false,
          can_access_reports: false,
          can_view_subscription: false,
          can_edit_own_profile: false,
          can_access_settings: false,
          employeeId: null,
          adminId: null,
          employeeName: null,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error("Erro ao buscar permissões:", error);
      // Em caso de erro, aplica menor privilégio por segurança
      setPermissions({
        isAdmin: false,
        isEmployee: false,
        can_access_dashboard: false,
        can_access_pos: false,
        can_access_products: false,
        can_access_customers: false,
        can_access_suppliers: false,
        can_access_history: false,
        can_access_mailbox: false,
        can_access_reports: false,
        can_view_subscription: false,
        can_edit_own_profile: false,
        can_access_settings: false,
        employeeId: null,
        adminId: null,
        employeeName: null,
      });
      setLoading(false);
    }
  };

  const canAccessRoute = (route: string): boolean => {
    // Admin sempre pode acessar tudo
    if (permissions.isAdmin) return true;

    // Se é funcionário e assinatura está inativa, bloqueia
    if (permissions.isEmployee && !subscriptionActive) return false;

    // Verificar permissões específicas por rota
    switch (route) {
      case "/dashboard":
        return permissions.can_access_dashboard;
      case "/pdv":
        return permissions.can_access_pos;
      case "/produtos":
        return permissions.can_access_products;
      case "/clientes":
        return permissions.can_access_customers;
      case "/fornecedores":
        return permissions.can_access_suppliers;
      case "/historico":
        return permissions.can_access_history;
      case "/caixa-correios":
        return permissions.can_access_mailbox;
      case "/relatorios":
        return permissions.can_access_reports;
      case "/assinatura":
        return permissions.can_view_subscription;
      case "/configuracoes":
        return permissions.can_access_settings;
      default:
        return false; // Por padrão, funcionários não têm acesso
    }
  };

  return { permissions, loading, canAccessRoute, subscriptionActive };
};
