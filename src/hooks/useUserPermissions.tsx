import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "./useSubscription";

interface UserPermissions {
  isAdmin: boolean;
  isEmployee: boolean;
  can_access_pos: boolean;
  can_access_products: boolean;
  can_access_customers: boolean;
  can_view_subscription: boolean;
  can_edit_own_profile: boolean;
  can_access_settings: boolean;
  employeeId: string | null;
  adminId: string | null;
}

export const useUserPermissions = () => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    isAdmin: false,
    isEmployee: false,
    can_access_pos: true,
    can_access_products: true,
    can_access_customers: true,
    can_view_subscription: true,
    can_edit_own_profile: true,
    can_access_settings: true,
    employeeId: null,
    adminId: null,
  });
  const [loading, setLoading] = useState(true);
  const { isActive: subscriptionActive } = useSubscription();

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

      // Buscar roles e employee data em paralelo para performance
      const [rolesResponse, employeeResponse] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("employees").select("id, admin_id").eq("user_id", user.id).maybeSingle()
      ]);

      const isAdmin = rolesResponse.data?.some(r => r.role === "admin") || false;

      if (isAdmin) {
        // Admin tem todas as permissões
        setPermissions({
          isAdmin: true,
          isEmployee: false,
          can_access_pos: true,
          can_access_products: true,
          can_access_customers: true,
          can_view_subscription: true,
          can_edit_own_profile: true,
          can_access_settings: true,
          employeeId: null,
          adminId: user.id,
        });
        setLoading(false);
        return;
      }

      const employee = employeeResponse.data;

      if (employee) {
        // Buscar permissões do funcionário
        const { data: perms } = await supabase
          .from("employee_permissions")
          .select("*")
          .eq("employee_id", employee.id)
          .single();

        setPermissions({
          isAdmin: false,
          isEmployee: true,
          can_access_pos: perms?.can_access_pos || false,
          can_access_products: perms?.can_access_products || false,
          can_access_customers: perms?.can_access_customers || false,
          can_view_subscription: perms?.can_view_subscription || false,
          can_edit_own_profile: perms?.can_edit_own_profile || false,
          can_access_settings: perms?.can_access_settings || false,
          employeeId: employee.id,
          adminId: employee.admin_id,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error("Erro ao buscar permissões:", error);
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
      case "/pdv":
        return permissions.can_access_pos;
      case "/produtos":
        return permissions.can_access_products;
      case "/clientes":
        return permissions.can_access_customers;
      case "/assinatura":
        return permissions.can_view_subscription;
      case "/configuracoes":
        return permissions.can_access_settings;
      default:
        return true;
    }
  };

  return { permissions, loading, canAccessRoute, subscriptionActive };
};
